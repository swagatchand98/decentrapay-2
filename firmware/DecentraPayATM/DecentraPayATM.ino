/*
 * DecentraPay college demo — ESP32-WROOM-32, R307, SG90, LED.
 * USB serial: 115200 baud, one JSON object per line.
 * Install Adafruit Fingerprint Sensor Library, ESP32Servo, ArduinoJson (7.x).
 * See docs/HARDWARE.md before connecting power.
 */
#include <Arduino.h>
#include <Adafruit_Fingerprint.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <Preferences.h>

constexpr int FINGER_RX = 16; // Sensor TX -> ESP32 RX
constexpr int FINGER_TX = 17; // Sensor RX <- ESP32 TX
constexpr int SERVO_PIN = 18;
constexpr int LED_PIN = 23;
constexpr int REST_ANGLE = 30;
constexpr int DISPENSE_ANGLE = 100;

Adafruit_Fingerprint finger(&Serial2);
Servo servo;
Preferences prefs;
bool sensorReady = false;
bool storageReady = false;
String input;
bool overflowing = false;

void sendError(const String &id, const char *error) {
  JsonDocument reply;
  reply["id"] = id; reply["ok"] = false; reply["error"] = error;
  serializeJson(reply, Serial); Serial.println();
}

void progress(const String &id, const char *message) {
  JsonDocument reply;
  reply["id"] = id; reply["event"] = "progress"; reply["message"] = message;
  serializeJson(reply, Serial); Serial.println();
}

bool capture(const String &id, uint8_t buffer, unsigned long start, unsigned long budget) {
  while (millis() - start < budget) {
    uint8_t result = finger.getImage();
    if (result == FINGERPRINT_OK) {
      if (finger.image2Tz(buffer) == FINGERPRINT_OK) return true;
      sendError(id, "Could not read fingerprint clearly. Clean the sensor and try again.");
      return false;
    }
    if (result != FINGERPRINT_NOFINGER) {
      sendError(id, "Fingerprint sensor communication/image error.");
      return false;
    }
    delay(40);
  }
  sendError(id, "Fingerprint scan timed out.");
  return false;
}

void handleCommand(const String &line) {
  JsonDocument request;
  if (deserializeJson(request, line)) { sendError("", "Invalid JSON."); return; }
  String id = request["id"] | "";
  String command = request["command"] | "";
  if (id.length() == 0 || id.length() > 80) { sendError(id, "Missing/invalid command id."); return; }
  JsonDocument reply;
  reply["id"] = id; reply["ok"] = true;

  if (command == "status") {
    sensorReady = finger.verifyPassword();
    reply["sensorReady"] = sensorReady;
    reply["firmware"] = "decentrapay-1.0";
  } else if (command == "scan") {
    if (!sensorReady) { sendError(id, "Fingerprint sensor not detected. Check power and RX/TX wiring."); return; }
    progress(id, "Place your enrolled finger on the sensor.");
    if (!capture(id, 1, millis(), 30000)) return;
    if (finger.fingerFastSearch() != FINGERPRINT_OK) { sendError(id, "Fingerprint not recognized. Try the enrolled finger."); return; }
    reply["slot"] = finger.fingerID;
    reply["confidence"] = finger.confidence;
  } else if (command == "enroll") {
    if (!sensorReady) { sendError(id, "Fingerprint sensor not detected."); return; }
    if ((request["slot"] | 0) != 1) { sendError(id, "This demo enrolls only slot 1."); return; }
    unsigned long start = millis();
    progress(id, "Place your finger on the sensor (first capture).");
    if (!capture(id, 1, start, 80000)) return;
    progress(id, "Remove your finger.");
    while (finger.getImage() != FINGERPRINT_NOFINGER) {
      if (millis() - start >= 80000) { sendError(id, "Enrollment timed out waiting for finger removal."); return; }
      delay(50);
    }
    progress(id, "Place the SAME finger again (second capture).");
    if (!capture(id, 2, start, 80000)) return;
    if (finger.createModel() != FINGERPRINT_OK) { sendError(id, "The two scans did not match. Try enrollment again."); return; }
    if (finger.storeModel(1) != FINGERPRINT_OK) { sendError(id, "Could not save fingerprint in slot 1."); return; }
    reply["slot"] = 1;
  } else if (command == "dispense") {
    String requestId = request["requestId"] | "";
    bool valid = requestId.length() == 66 && requestId.startsWith("0x");
    for (unsigned int i = 2; valid && i < requestId.length(); i++) valid = isxdigit(requestId[i]);
    if (!valid) { sendError(id, "Invalid blockchain request id."); return; }
    requestId.toLowerCase();
    if (!storageReady || !servo.attached()) { sendError(id, "Servo or persistent storage is unavailable."); return; }
    if (prefs.getString("lastRequest", "") == requestId) { sendError(id, "Duplicate dispense refused."); return; }
    // Record before movement. After a lost reply/reboot, don't repeat this cycle.
    if (prefs.putString("lastRequest", requestId) == 0) { sendError(id, "Could not record dispense attempt."); return; }
    digitalWrite(LED_PIN, HIGH);
    servo.write(DISPENSE_ANGLE);
    delay(1000);
    servo.write(REST_ANGLE);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    reply["completed"] = true; // Sequence completed; no cash/position sensor is present.
  } else { sendError(id, "Unknown command."); return; }
  serializeJson(reply, Serial); Serial.println();
}

void setup() {
  Serial.begin(115200);
  Serial2.begin(57600, SERIAL_8N1, FINGER_RX, FINGER_TX);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  servo.setPeriodHertz(50);
  servo.attach(SERVO_PIN, 500, 2400);
  servo.write(REST_ANGLE);
  storageReady = prefs.begin("decentrapay", false);
  delay(600);
  sensorReady = finger.verifyPassword();
  input.reserve(512);
  Serial.println("{\"event\":\"ready\",\"firmware\":\"decentrapay-1.0\"}");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (overflowing) sendError("", "Command too long.");
      else if (input.length()) handleCommand(input);
      input = ""; overflowing = false;
    } else if (c != '\r' && !overflowing) {
      if (input.length() >= 512) overflowing = true;
      else input += c;
    }
  }
  delay(2);
}
