/*
 ======================================================================================
  Project: The super Girls - IoT Smart Environment Monitoring & Hardware Automation
  Authors: Renuka, Nisha, Utkarsha
  Department: Dept. of Electrical Engineering, Gov. Engineering Yavatmal
  Hardware:
    - Microcontroller: ESP8266 (NodeMCU ESP-12E / D1 Mini)
    - Temperature & Humidity Sensor: DHT11 connected to Pin D5 (GPIO 14)
    - Actuator: LED connected to Pin D3 (GPIO 0)
    - Display: 16x2 LCD with I2C Module connected to D1 (SCL, GPIO 5) & D2 (SDA, GPIO 4)
  Network Settings:
    - WiFi SSID: IoT
    - WiFi Password: 12345678
 ======================================================================================
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ------------------------------------------------------------------------------------
// 1. PIN DEFINITIONS & CONSTANTS
// ------------------------------------------------------------------------------------
#define DHTPIN       14      // Pin D5 corresponds to GPIO 14 on ESP8266
#define DHTTYPE      DHT11   // DHT 11 sensor type
#define LED_PIN      0       // Pin D3 corresponds to GPIO 0 on ESP8266
#define SDA_PIN      4       // Pin D2 corresponds to GPIO 4 (I2C SDA)
#define SCL_PIN      5       // Pin D1 corresponds to GPIO 5 (I2C SCL)

// ------------------------------------------------------------------------------------
// 2. NETWORK & SERVER CONFIGURATION
// ------------------------------------------------------------------------------------
const char* ssid     = "IoT";
const char* password = "12345678";

// Backend Server URL:
// Configured for live Render Cloud Deployment:
const char* serverUrl = "https://iot-project-pn6x.onrender.com";

// API endpoints
String sensorDataEndpoint = String(serverUrl) + "/api/sensor-data";
String deviceSyncEndpoint = String(serverUrl) + "/api/device/sync";

// Optional Device API Key (Must match API_KEY in server .env)
const char* apiKey = "supergirls_esp8266_token_secure";

// ------------------------------------------------------------------------------------
// 3. HARDWARE INSTANCES
// ------------------------------------------------------------------------------------
DHT dht(DHTPIN, DHTTYPE);

// 16x2 LCD I2C address is typically 0x27 or 0x3F
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Timing variables
unsigned long lastSensorPostTime = 0;
const unsigned long sensorPostInterval = 10000; // 10 seconds as specified

unsigned long lastDeviceSyncTime = 0;
const unsigned long deviceSyncInterval = 2500;   // 2.5 seconds sync for responsive LED & LCD

// Cached states to avoid unnecessary LCD flickering
String currentLcdLine1 = "";
String currentLcdLine2 = "";
int currentLedState = -1;

// ------------------------------------------------------------------------------------
// 4. SETUP
// ------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n=========================================");
  Serial.println("  The super Girls - IoT System Booting   ");
  Serial.println("=========================================");

  // Initialize LED Pin
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW); // LED OFF initially

  // Initialize I2C Bus for LCD
  Wire.begin(SDA_PIN, SCL_PIN);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("The super Girls ");
  lcd.setCursor(0, 1);
  lcd.print("Dept of EE GCOEY");
  delay(2000);

  // Initialize DHT11
  dht.begin();

  // Connect to WiFi
  connectWiFi();
}

// ------------------------------------------------------------------------------------
// 5. MAIN LOOP
// ------------------------------------------------------------------------------------
void loop() {
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  unsigned long currentMillis = millis();

  // Task 1: Post DHT11 Sensor Data every 10 Seconds
  if (currentMillis - lastSensorPostTime >= sensorPostInterval) {
    lastSensorPostTime = currentMillis;
    readAndSendSensorData();
  }

  // Task 2: Sync Device State (LED & LCD) every 2.5 Seconds
  if (currentMillis - lastDeviceSyncTime >= deviceSyncInterval) {
    lastDeviceSyncTime = currentMillis;
    syncDeviceState();
  }
}

// ------------------------------------------------------------------------------------
// 6. HELPER FUNCTIONS
// ------------------------------------------------------------------------------------

// WiFi Connection Handler
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi:");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected Successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
  } else {
    Serial.println("\nWiFi Connection Failed! Will retry...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Conn Failed");
    lcd.setCursor(0, 1);
    lcd.print("Retrying...");
  }
}

// Read DHT11 Sensor & Post to Server
void readAndSendSensorData() {
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[DHT11] Warning: Failed to read from DHT sensor!");
    return;
  }

  Serial.println("----------------------------------------");
  Serial.printf("[DHT11] Temperature: %.1f C | Humidity: %.1f %%\n", temperature, humidity);

  // Prepare JSON payload
  StaticJsonDocument<200> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["api_key"] = apiKey;

  String requestBody;
  serializeJson(doc, requestBody);

  HTTPClient http;
  bool isHttps = String(serverUrl).startsWith("https://");

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Render uses Let's Encrypt SSL certificates
    if (http.begin(secureClient, sensorDataEndpoint)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", apiKey);
      int httpCode = http.POST(requestBody);
      Serial.printf("[HTTP POST HTTPS] Code: %d\n", httpCode);
      http.end();
    }
  } else {
    WiFiClient client;
    if (http.begin(client, sensorDataEndpoint)) {
      http.addHeader("Content-Type", "application/json");
      http.addHeader("X-API-Key", apiKey);
      int httpCode = http.POST(requestBody);
      Serial.printf("[HTTP POST HTTP] Code: %d\n", httpCode);
      http.end();
    }
  }
}

// Sync Device State (LED and LCD text) from Server
void syncDeviceState() {
  HTTPClient http;
  bool isHttps = String(serverUrl).startsWith("https://");
  int httpCode = 0;
  String payload = "";

  if (isHttps) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();
    if (http.begin(secureClient, deviceSyncEndpoint)) {
      http.addHeader("X-API-Key", apiKey);
      httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) payload = http.getString();
      http.end();
    }
  } else {
    WiFiClient client;
    if (http.begin(client, deviceSyncEndpoint)) {
      http.addHeader("X-API-Key", apiKey);
      httpCode = http.GET();
      if (httpCode == HTTP_CODE_OK) payload = http.getString();
      http.end();
    }
  }

  if (httpCode == HTTP_CODE_OK && payload.length() > 0) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      int newLedState = doc["led"];
      String newLcdLine1 = doc["l1"].as<String>();
      String newLcdLine2 = doc["l2"].as<String>();

      // 1. Actuate LED if state changed
      if (newLedState != currentLedState) {
        currentLedState = newLedState;
        digitalWrite(LED_PIN, currentLedState == 1 ? HIGH : LOW);
        Serial.printf("[LED ACTUATOR] State changed -> %s\n", currentLedState == 1 ? "HIGH (ON)" : "LOW (OFF)");
      }

      // 2. Update LCD if message changed
      if (newLcdLine1 != currentLcdLine1 || newLcdLine2 != currentLcdLine2) {
        currentLcdLine1 = newLcdLine1;
        currentLcdLine2 = newLcdLine2;

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(currentLcdLine1.substring(0, 16));
        lcd.setCursor(0, 1);
        lcd.print(currentLcdLine2.substring(0, 16));

        Serial.println("[LCD ACTUATOR] Display Updated:");
        Serial.printf("  Line 1: %s\n", currentLcdLine1.c_str());
        Serial.printf("  Line 2: %s\n", currentLcdLine2.c_str());
      }
    }
  }
}
