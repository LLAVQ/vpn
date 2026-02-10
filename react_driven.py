import json, os, uuid, subprocess, shutil, urllib.parse, sqlite3, asyncio, socket, time, random, re
from datetime import datetime
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import psutil
import uvicorn

app = FastAPI()

# Enable CORS for independent frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CONFIG_FILE = 'config.json'
DB_FILE = 'analytics.db'
XRAY_LOG_FILE = 'access.log' # The file Xray-core writes to

# --- Global State for Intercepts ---
traffic_logs = []
MAX_LOG_SIZE = 100 # Increased log history

# --- Backend Logic ---

def init_db():
    conn = sqlite3.connect(DB_FILE)
    # Added 'diff_up' and 'diff_down' to track real-time delta (speed)
    conn.execute('CREATE TABLE IF NOT EXISTS stats (timestamp DATETIME, port INTEGER, uplink INTEGER, downlink INTEGER, diff_up INTEGER, diff_down INTEGER)')
    conn.commit()
    conn.close()
    # Ensure log file exists for tailing
    if not os.path.exists(XRAY_LOG_FILE):
        with open(XRAY_LOG_FILE, 'w') as f:
            f.write(f"{datetime.now()} [Info] X-CORE Logger Started\n")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f: return json.load(f)
        except: pass
    return {"inbounds": [], "outbounds": [{"protocol": "freedom"}], "log": {"access": XRAY_LOG_FILE, "loglevel": "info"}}

def save_config(config):
    with open(CONFIG_FILE, 'w') as f: 
        json.dump(config, f, indent=4)

def parse_xray_log_line(line):
    """
    Parses Xray access log lines.
    Format example: 2023/10/27 10:00:00 127.0.0.1:12345 accepted tcp:google.com:443 [inbound-tag]
    """
    try:
        # Simple regex to find the target domain and protocol
        match = re.search(r"accepted\s+(tcp|udp|ws):([^\s:]+)", line)
        if match:
            protocol = match.group(1).upper()
            domain = match.group(2)
            return {
                "id": int(time.time() * 1000) + random.randint(0, 999),
                "time": datetime.now().strftime("%H:%M:%S"),
                "method": protocol,
                "domain": domain,
                "size": f"{random.randint(1, 500)} KB" # Mocked size since access logs don't provide bytes
            }
    except Exception:
        pass
    return None

async def log_tailer_task():
    """
    Tails the real Xray access log file to intercept live traffic.
    """
    if not os.path.exists(XRAY_LOG_FILE):
        return

    # Move to end of file
    file = open(XRAY_LOG_FILE, 'r')
    file.seek(0, os.SEEK_END)

    while True:
        line = file.readline()
        if not line:
            await asyncio.sleep(0.5)
            continue
        
        intercept = parse_xray_log_line(line)
        if intercept:
            traffic_logs.insert(0, intercept)
            if len(traffic_logs) > MAX_LOG_SIZE:
                traffic_logs.pop()

async def monitor_task():
    """
    Background task to monitor system stats and log data usage for inbounds.
    Improved to simulate 'per-second' speed diffs.
    """
    while True:
        config = load_config()
        conn = sqlite3.connect(DB_FILE)
        
        for ib in config.get("inbounds", []):
            port = ib["port"]
            # In a real production setup, use: xray api stats --name "inbound>>>[tag]>>>traffic>>>downlink"
            # Here we simulate real-time 'speed' (diff) and 'total' (uplink/downlink)
            diff_up = random.randint(10, 500)
            diff_down = random.randint(50, 2000)
            
            # Get last total to increment
            cursor = conn.execute("SELECT uplink, downlink FROM stats WHERE port=? ORDER BY timestamp DESC LIMIT 1", (port,))
            last = cursor.fetchone()
            total_up = (last[0] if last else 0) + diff_up
            total_down = (last[1] if last else 0) + diff_down
            
            conn.execute("INSERT INTO stats VALUES (?, ?, ?, ?, ?, ?)", 
                         (datetime.now(), port, total_up, total_down, diff_up, diff_down))
        
        conn.commit()
        conn.close()
        await asyncio.sleep(2) # Faster updates for "right in time" info

# --- API Endpoints ---

@app.get("/api/data")
async def get_all_data():
    config = load_config()
    inbounds_list = []
    conn = sqlite3.connect(DB_FILE)
    
    for ib in config.get("inbounds", []):
        port = ib["port"]
        # Increased LIMIT to 60 for longer usage analytics window
        cursor = conn.execute("""
            SELECT timestamp, uplink, downlink, diff_up, diff_down 
            FROM stats WHERE port=? 
            ORDER BY timestamp DESC LIMIT 60
        """, (port,))
        rows = cursor.fetchall()
        
        # History mapping including 'speed' (diff) for real-time charts
        history = [{"up": r[3], "down": r[4], "total_up": r[1], "total_down": r[2]} for r in rows][::-1]
        
        inbounds_list.append({
            "id": port,
            "port": port,
            "path": ib.get("streamSettings", {}).get("wsSettings", {}).get("path", "/"),
            "online": True,
            "uuid": ib.get("settings", {}).get("clients", [{}])[0].get("id", "N/A"),
            "stats": history if history else [{"up": 0, "down": 0, "total_up": 0, "total_down": 0}]
        })
    conn.close()
    
    # Calculate global traffic totals
    total_in_memory_traffic = sum([ib['stats'][-1]['total_down'] for ib in inbounds_list if ib['stats']])
    
    return {
        "systemOnline": True, 
        "inbounds": inbounds_list,
        "logs": traffic_logs,
        "sys": {
            "cpu": psutil.cpu_percent(),
            "ram": psutil.virtual_memory().percent,
            "uptime": "Live",
            "connections": len(traffic_logs),
            "total_traffic": f"{total_in_memory_traffic / 1024:.2f} MB"
        }
    }

@app.post("/api/inbound")
async def add_inbound(port: int = Form(...), path: str = Form(...)):
    config = load_config()
    if any(ib['port'] == port for ib in config['inbounds']):
        return JSONResponse(status_code=400, content={"detail": "PORT_ALREADY_EXISTS"})
        
    new_uuid = str(uuid.uuid4())
    new_ib = {
        "port": port,
        "protocol": "vless",
        "settings": {"clients": [{"id": new_uuid}], "decryption": "none"},
        "streamSettings": {"network": "ws", "wsSettings": {"path": path}}
    }
    config["inbounds"].append(new_ib)
    save_config(config)
    return {"status": "success"}

@app.delete("/api/inbound/{port}")
async def delete_inbound(port: int):
    config = load_config()
    config["inbounds"] = [ib for ib in config["inbounds"] if ib["port"] != port]
    save_config(config)
    conn = sqlite3.connect(DB_FILE)
    conn.execute("DELETE FROM stats WHERE port=?", (port,))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_task())
    asyncio.create_task(log_tailer_task())

if __name__ == "__main__":
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=3000)