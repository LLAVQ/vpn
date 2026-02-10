import json, os, uuid, subprocess, shutil, urllib.parse

def setup():
    PORT = 8080
    PATH = "/vless-ws"
    USER_UUID = str(uuid.uuid4())
    
    # 1. Install Xray on Server
    if not shutil.which("xray"):
        print("[-] Installing Xray on Codespace...")
        subprocess.run('sudo bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install', shell=True)

    # 2. Create Server Config (Python uses True, not true)
    server_config = {
        "inbounds": [{
            "port": PORT, "protocol": "vless",
            "settings": {"clients": [{"id": USER_UUID}], "decryption": "none"},
            "streamSettings": {"network": "ws", "wsSettings": {"path": PATH}}
        }],
        "outbounds": [{"protocol": "freedom"}]
    }
    with open('config.json', 'w') as f:
        json.dump(server_config, f, indent=4)

    # 3. Generate Share Link for Phone
    codespace_name = os.getenv('CODESPACE_NAME')
    address = f"{codespace_name}-{PORT}.app.github.dev"
    
    # URL Encoding for the link parameters
    params = urllib.parse.urlencode({
        "encryption": "none",
        "security": "tls",
        "type": "ws",
        "host": address,
        "sni": address,
        "path": PATH
    })
    
    # The standard VLESS format: vless://uuid@host:port?params#name
    vless_link = f"vless://{USER_UUID}@{address}:443?{params}#Codespace-VLESS"

    print("\n" + "="*60)
    print("ONE-CLICK IMPORT LINK FOR PHONE (Shadowrocket/v2rayNG)")
    print("="*60)
    print(f"\n{vless_link}\n")
    print("="*60)
    print(f"ACTION: Set Port {PORT} to PUBLIC in the 'Ports' tab!")
    print("="*60)
    
    # 4. Start Server
    subprocess.run(["sudo", "xray", "run", "-c", "config.json"])

if __name__ == "__main__":
    setup()
