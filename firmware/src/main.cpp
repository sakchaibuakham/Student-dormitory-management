#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";         // ใส่ชื่อ Wi-Fi ของคุณตรงนี้
const char* password = "YOUR_WIFI_PASSWORD"; // ใส่รหัสผ่าน Wi-Fi ของคุณตรงนี้
const char* serverUrl = "http://192.168.1.101:5000/api/verify-face";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["studentId"] = "68028531"; // รหัสประจำตัวนักศึกษาของคุณ
    doc["confidence"] = 95.5;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response from server: " + response);
    } else {
      Serial.printf("Error on sending POST: %d\n", httpResponseCode);
    }
    http.end();
  }
  delay(15000);
}