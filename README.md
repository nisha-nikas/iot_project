# The super Girls - IoT Smart Environment Monitoring & Automation

A modern, full-stack IoT web application designed for real-time environmental telemetry (DHT11), LCD display control, and remote hardware actuation (LED) using an **ESP8266** microcontroller, **Node.js**, **SQLite**, **HTML & Tailwind CSS (White Theme)**, and ready for deployment on **Render**.

> **Designed and Developed by:** Renuka, Nisha, Utkarsha  
> **Institution:** Dept. of Electrical Engineering, Gov. Engineering Yavatmal  
> **Timezone:** Asia/Kolkata (+5:30 IST)

---

## 🌟 Key Features

1. **Clean White Theme UI**:
   - Modern, bright aesthetics built with **HTML & Tailwind CSS** and **Lucide Icons** (No placeholder images).
   - Designed for high visual appeal, responsive on mobile and desktop.
2. **Tab 1: Environment Monitoring**:
   - Automatic DHT11 data capture every **10 seconds**.
   - **Section 1**: Innovative **Circular SVG Gauges** and **Seek Bars** for Temperature (°C) and Humidity (%).
   - **Section 2**: Paginated history table (`# | Temperature | Humidity | Time | Date | Action (Delete)`), showing **latest records first** (20 records per page) with delete action.
   - Interactive **Chart.js dual-axis telemetry graph** tracking real-time trends over time.
   - Built-in "Simulate Reading" feature for testing anytime without hardware plugged in.
3. **Tab 2: Smart LCD**:
   - Real-time 16x2 text update via `Row 1` and `Row 2` inputs with 16-character live counter.
   - **Interactive Virtual LCD Preview** with realistic dot-matrix simulation and toggleable green/blue backlight modes.
   - Updates hardware 16x2 I2C LCD screen on the ESP8266.
4. **Tab 3: LED Automation**:
   - Instant toggle switch turning physical LED **ON** or **OFF** connected to ESP8266 **Pin D3 (GPIO 0)**.
   - Big glowing status orb and optimistic UI updates.
5. **Security & Database**:
   - User authentication: Register (Name, Email, Password) & Login (Email, Password) with bcrypt password hashing and JWT token management.
   - **SQLite** database storing users, sensor logs, and live hardware state.

---

## 🛠️ Hardware Wiring & Components

| Component | ESP8266 Pin | GPIO Pin | Notes |
| :--- | :--- | :--- | :--- |
| **DHT11 Data** | **D5** | GPIO 14 | 10k pull-up resistor between VCC and DATA recommended |
| **DHT11 VCC** | **3V3** | - | Power supply (3.3V) |
| **DHT11 GND** | **GND** | - | Ground |
| **LED Anode (+)**| **D3** | GPIO 0 | Connect via 220Ω - 330Ω current limiting resistor |
| **LED Cathode (-)**| **GND** | - | Ground |
| **LCD 16x2 SCL** | **D1** | GPIO 5 | I2C Clock Pin |
| **LCD 16x2 SDA** | **D2** | GPIO 4 | I2C Data Pin |
| **LCD VCC** | **VIN / 5V** | - | 5V supply for I2C backpack |
| **LCD GND** | **GND** | - | Common Ground |

*Note: Most 16x2 I2C modules use I2C address `0x27` (or `0x3F`).*

---

## 🌐 WiFi & ESP8266 Configuration

The Arduino sketch is pre-configured with your requested credentials:
- **WiFi SSID**: `IoT`
- **WiFi Password**: `12345678`

### Arduino Code Location:
- Open [`arduino/esp8266_the_super_girls/esp8266_the_super_girls.ino`](file:///c:/Users/Nisha/Desktop/iot%20project/arduino/esp8266_the_super_girls/esp8266_the_super_girls.ino) in Arduino IDE.
- Required Libraries (Install via **Arduino IDE -> Sketch -> Include Library -> Manage Libraries**):
  1. `ESP8266WiFi` (Installed automatically with ESP8266 Board package)
  2. `ESP8266HTTPClient` (Installed automatically with ESP8266 Board package)
  3. `DHT sensor library` by Adafruit
  4. `Adafruit Unified Sensor` by Adafruit
  5. `LiquidCrystal_I2C` by Frank de Brabander or Marco Schwartz
  6. `ArduinoJson` (v6.x or v7.x) by Benoit Blanchon
- In the `.ino` file, set `serverUrl`:
  - When testing locally on same WiFi: `const char* serverUrl = "http://YOUR_PC_LOCAL_IP:3000";` (e.g. `http://192.168.1.15:3000`)
  - When deployed on Render: `const char* serverUrl = "https://your-service.onrender.com";` (Supports HTTPS automatically!)

---

## 🚀 Running the Web Application Locally

Node.js v20 LTS is installed and configured in your environment.

1. **Start the Server**:
   ```powershell
   npm start
   ```
2. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```
3. Create an account or sign in, and you will be routed directly to the interactive dashboard.

---

## ☁️ Deploying to Render (Step-by-Step)

This application is configured for 100% turnkey deployment on **Render**:

### Method 1: Blueprint Deployment (Easiest)
1. Initialize a git repository and commit all files:
   ```bash
   git init
   git add .
   git commit -m "The super Girls IoT Project initial commit"
   ```
2. Push your repository to your **GitHub** account.
3. Log in to [Render.com](https://render.com).
4. Click **New +** -> **Blueprint**.
5. Select your GitHub repository. Render will automatically detect [`render.yaml`](file:///c:/Users/Nisha/Desktop/iot%20project/render.yaml) and configure everything!
6. Click **Apply**.

### Method 2: Manual Web Service on Render
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `the-super-girls-iot`
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
4. Under **Advanced / Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `supergirls_iot_secret_key_2026_secured`
   - `API_KEY`: `supergirls_esp8266_token_secure`
6. Live Deployed URL: **`https://iot-project-pn6x.onrender.com`**.
7. The Arduino `.ino` sketch is configured with `https://iot-project-pn6x.onrender.com`. Flash it to your ESP8266, and your hardware is globally connected!

---

## 📄 License & Attribution

Designed and Developed by:
- **Renuka**
- **Nisha**
- **Utkarsha**
*Dept. of Electrical Engineering, Gov. Engineering Yavatmal*
