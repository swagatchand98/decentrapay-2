# From software demo to presentation

The software simulator has been demonstrated successfully by the student. Physical hardware is not yet purchased or tested. Work through these gates in order; do not mark physical tests passed using simulator results.

## Gate 1 — Purchase

| Check | Qty | Buy this | Check before ordering |
|---|---:|---|---|
| [ ] | 1 | ESP32-WROOM-32 38-pin development board | USB connector and soldered headers; classic WROOM rather than C3/S3/WROVER |
| [ ] | 1 | R307 UART optical fingerprint sensor | Cable included, documented connector pinout, rated supply and 3.3 V-compatible UART |
| [ ] | 1 | SG90 180-degree positional servo | Include arm and screws; do not order the continuous-rotation version |
| [ ] | 1 | Standard LED | Any readily visible color |
| [ ] | 1 | 330-ohm resistor | For the LED, not for the servo supply |
| [ ] | 2 | Solderless breadboards | Allow room around the wide ESP32 board |
| [ ] | 1 set | Dupont jumper wires | Male/male, male/female, female/female |
| [ ] | 1 | USB data cable | Match the board connector; charging-only cables will not upload firmware |
| [ ] | 1 | Regulated 5 V / 2 A power adapter | Accessible, labelled low-voltage output |
| [ ] | 1 | Matching female DC jack to screw-terminal breakout | Match the adapter plug size and polarity |
| [ ] | 1 set | Cardboard/foam board, tape, printed labels | Build the enclosure after bench tests pass |

Model references: [ESP32](https://robocraze.com/products/esp32-development-board), [R307](https://robocraze.com/products/r307-optical-fingerprint-sensor-module), [SG90](https://robu.in/product-category/towerpro-servo-motor/). Prices and availability are not guaranteed. The purchased sensor's pinout takes precedence over generic wire colors.

## Gate 2 — Firmware and bench assembly

- [ ] Read `docs/HARDWARE.md` and identify the actual connector labels before applying power.
- [ ] Install Arduino IDE, Espressif ESP32 board support, Adafruit Fingerprint Sensor Library, ESP32Servo, and ArduinoJson 7.x.
- [ ] Select ESP32 Dev Module and the correct USB port; compile and upload `firmware/DecentraPayATM/DecentraPayATM.ino`.
- [ ] Record the board package and library versions that compiled successfully in `presentation/physical-acceptance.csv` notes or the evidence README.
- [ ] Disconnect power, wire the sensor/LED/servo, then inspect all connections.
- [ ] Power the board from laptop USB. Power peripherals from the external supply according to their ratings. Join grounds; do not join the external +5 V to the USB-powered board's 5 V pin.
- [ ] Close Serial Monitor and stop the ATM server before enrollment.
- [ ] Copy `.env.example` to `.env`; set `HARDWARE_MODE=serial`.
- [ ] Run `npm run ports` and set `SERIAL_PORT` to the actual port.
- [ ] Run `npm run enroll -- 0x70997970C51812dc3A010C7d01b50e0d17dc79C8`; follow both finger captures.
- [ ] Run `npm run hardware:check`; observe one real movement and LED cycle.

The bench check intentionally operates without a blockchain payment. It is separate from the presentation's full withdrawal demonstration.

## Gate 3 — Full hardware workflow

- [ ] Start `npm run demo:reset` and keep the terminal running.
- [ ] Select DecentraPay Local and the imported demo account in MetaMask.
- [ ] Verify that the ATM page says **ESP32 hardware mode** and shows the expected account.
- [ ] Perform physical withdrawals of Rs 100, Rs 200, and Rs 500; record each transaction and observation in the acceptance sheet.
- [ ] Try an unknown finger: no payment request or servo movement should follow.
- [ ] Reject MetaMask approval: no dispense cycle should follow.
- [ ] Check disconnected-device behavior. If payment already confirmed, inspect the device rather than replaying the old request.

## Gate 4 — Enclosure

Use a box roughly 25 cm tall, 18 cm wide, and 12 cm deep, adapting openings to the actual parts. Keep the laptop outside as the screen. Mount the fingerprint sensor on the front, the LED above the flap, and the servo inside with a light paper/card flap attached to its arm. Use the included printable labels.

Leave the back open/removable for wiring inspection. Secure the board on an insulating base; keep wire joints away from the servo arm. Check movement with the supplied arm first, then mount the flap without loading the motor against a stop. No note-feeding mechanism is required. Test all three amounts again after mounting.

## Gate 5 — Submission and rehearsal

- [ ] Replace bracketed student/college/guide/date placeholders in the editable slides and report.
- [ ] Add one actual full-assembly photograph and one close-up of the sensor/servo after assembly; label them as hardware photographs, not illustrations.
- [ ] Add a screenshot of a successful withdrawal with its transaction hash. The supplied screenshot documents the earlier wallet mismatch only.
- [ ] Update physical results only after real tests; maintain the distinction between software evidence and hardware evidence.
- [ ] Re-export slides/report to PDF after editing the PPTX/DOCX so both versions match.
- [ ] Rehearse using `presentation/SPEAKER_NOTES.md` and the printable bench sheet.
- [ ] Record a 60–90 second video of a real successful hardware run, labelled as a recording.
- [ ] Store slides, report, video, source code, and installed dependencies on the presentation laptop; also copy the documents to a USB drive.
- [ ] Rehearse with internet disconnected after dependencies are installed. Do not change package versions immediately before presenting.

Do not buy test ETH or send real funds. This project only needs the public local-development account supplied in README.md.
