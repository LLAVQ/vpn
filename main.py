import json, os, uuid, subprocess, shutil, urllib.parse, sqlite3, asyncio, socket
from datetime import datetime
from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from io import BytesIO
import qrcode
import psutil

app = FastAPI(title="Xray Professional Panel")
templates = Jinja2Templates(directory="templates")

CONFIG_FILE = 'config.json'
DB_FILE = 'analytics.db'

# --- Core Logic & Database ---
def init_db():
    conn = sqlite3.connect(DB_FILE)
    conn.execute('''CREATE TABLE IF NOT EXISTS stats 
                 (timestamp DATETIME, port INTEGER, uplink INTEGER, downlink INTEGER)''')
    conn.commit()
    conn.close()

def load_config():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {"inbounds": [], "outbounds": [{"protocol": "freedom"}]}

def save_and_apply(config):
    # Ensure Stats/API are enabled in the JSON
    config["stats"] = {}
    config["api"] = {"tag": "api", "services": ["StatsService"]}
    config["policy"] = {
        "levels": {"0": {"statsUserUplink": True, "statsUserDownlink": True}},
        "system": {"statsInboundUplink": True, "statsInboundDownlink": True}
    }
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def get_xray_status():
    for proc in psutil.process_iter(['name']):
        if 'xray' in proc.info['name'].lower(): return True
    return False

def generate_vless_link(ib):
    try:
        uuid_str = ib["settings"]["clients"][0]["id"]
        port = ib["port"]
        path = ib["streamSettings"]["wsSettings"]["path"]
        codespace = os.getenv('CODESPACE_NAME', 'localhost')
        address = f"{codespace}-{port}.app.github.dev" if codespace != 'localhost' else "127.0.0.1"
        params = urllib.parse.urlencode({"encryption": "none", "security": "tls", "type": "ws", "host": address, "sni": address, "path": path})
        return f"vless://{uuid_str}@{address}:443?{params}#Inbound-{port}"
    except: return ""

# --- Background Monitoring Task ---
async def monitor_traffic():
    """Records traffic stats every 60 seconds"""
    while True:
        await asyncio.sleep(60)
        config = load_config()
        conn = sqlite3.connect(DB_FILE)
        import random # Replace with actual 'xray api stats' call in production
        for ib in config.get("inbounds", []):
            port = ib["port"]
            # Simulating data: In production, poll the Xray API here
            up = random.randint(0, 500) if is_port_open(port) else 0
            down = random.randint(0, 2000) if is_port_open(port) else 0
            conn.execute("INSERT INTO stats VALUES (?, ?, ?, ?)", (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), port, up, down))
        conn.commit()
        conn.close()

# --- Routes ---
@app.on_event("startup")
async def startup():
    init_db()
    asyncio.create_task(monitor_traffic())

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    config = load_config()
    xray_live = get_xray_status()
    inbounds_data = []
    for idx, ib in enumerate(config.get("inbounds", [])):
        port = ib["port"]
        active = xray_live and is_port_open(port)
        inbounds_data.append({
            "id": idx, "port": port, "path": ib["streamSettings"]["wsSettings"]["path"],
            "link": generate_vless_link(ib),
            "status": "Online" if active else "Offline",
            "color": "success" if active else "danger"
        })
    return templates.TemplateResponse("index.html", {
        "request": request, "inbounds": inbounds_data, "sys": "Active" if xray_live else "Down"
    })

@app.get("/api/history/{port}")
async def get_history(port: int):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.execute("SELECT timestamp, uplink, downlink FROM stats WHERE port=? ORDER BY timestamp DESC LIMIT 30", (port,))
    rows = cursor.fetchall()
    conn.close()
    return [{"t": r[0].split(' ')[1], "up": r[1], "down": r[2]} for r in reversed(rows)]

@app.post("/add")
async def add_inbound(port: int = Form(...), path: str = Form(...)):
    config = load_config()
    config["inbounds"].append({
        "port": port, "protocol": "vless", "tag": f"inbound-{port}",
        "settings": {"clients": [{"id": str(uuid.uuid4())}], "decryption": "none"},
        "streamSettings": {"network": "ws", "wsSettings": {"path": path}}
    })
    save_and_apply(config)
    return HTMLResponse("<script>window.location.href='/';</script>")

@app.get("/qr/{idx}")
async def get_qr(idx: int):
    config = load_config()
    link = generate_vless_link(config["inbounds"][idx])
    img = qrcode.make(link)
    buf = BytesIO()
    img.save(buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)