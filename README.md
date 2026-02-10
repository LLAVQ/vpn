

# Xray Management Panel & Analytics

A FastAPI-based web interface designed to manage Xray VLESS inbounds, monitor server health, and visualize traffic usage with time-dependent graphs.

## 🚀 Features

* **FastAPI Backend:** High-performance web server for configuration management.
* **Inbound Management:** Add new VLESS-WebSocket inbounds dynamically via the UI.
* **Live Status Monitoring:** Real-time "Online/Offline" detection for the Xray process and individual ports.
* **Traffic Analytics:** Historical data tracking for Uplink and Downlink speeds using SQLite.
* **Time-Dependent Graphs:** Visual representation of usage peaks and idle times using Chart.js.
* **Mobile Ready:** Automatic generation of VLESS share links and scannable QR codes.

---

## 🛠 Installation

### 1. Install Dependencies

Run the following command to install the required Python packages:

```bash
pip install fastapi uvicorn qrcode[pil] jinja2 python-multipart psutil

```

### 2. File Structure

Ensure your project directory looks like this:

```text
.
├── main.py          # The FastAPI application code
├── templates/
│   └── index.html   # The dashboard UI template
├── config.json      # Xray configuration (generated automatically)
└── analytics.db     # Historical data (created on first run)

```

---

## 🚦 How to Run

1. **Start Xray:** Ensure the Xray core is installed and running on your system.
2. **Start the Panel:**
```bash
python main.py

```


3. **Access the UI:**
* If on **GitHub Codespaces**: Click the popup to "Open in Browser" or check the Ports tab (Port 3000).
* If on a **Local Server**: Navigate to `http://localhost:3000`.



---

## 📈 Understanding the Analytics

The panel uses a background worker to poll traffic data every 60 seconds.

* **Status Badges:** * <span style="color:green">● Online</span>: Xray is running and the port is actively listening.
* <span style="color:red">● Offline</span>: The port is unreachable or the service has stopped.


* **Graphs:** The X-axis represents the time, and the Y-axis represents traffic in KB.
* **Peaks:** Indicate active usage or streaming.
* **Flatlines:** Indicate periods of "No Usage," helping you identify idle inbounds.



---

## 🔧 Technical Details

* **Database:** Uses SQLite for zero-config persistence.
* **Xray Integration:** Modifies `config.json` to enable the `StatsService` and `API` tags, allowing the panel to query traffic metrics internally.
* **Network Detection:** Uses socket-level "heartbeats" to verify port availability rather than just relying on the config file.

## ⚠️ Security Note

This panel is designed for management. If deploying on a public server, ensure you implement **FastAPI Security (OAuth2/API Keys)** to prevent unauthorized access to your proxy configurations.