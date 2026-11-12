# Presentation pack

This folder contains the college presentation deliverables. The software has working simulator withdrawal evidence; physical hardware verification remains pending.

## Open these files

- `DecentraPay-Presentation.pptx` — editable 10-slide deck, with speaker notes.
- `DecentraPay-Presentation.pdf` — matching slide PDF for offline viewing.
- `DecentraPay-Report.docx` — editable 14-page report.
- `DecentraPay-Report.pdf` — report PDF.
- `Bench-Checklist.pdf` — printable wiring summary, setup commands, and physical acceptance sheet.
- `ATM-Labels.pdf` — printable labels for the cardboard model.
- `physical-acceptance.csv` — blank physical test record, explicitly marked NOT RUN.
- `SPEAKER_NOTES.md` — five-minute presentation script and common questions.
- `../docs/PRESENTATION_CHECKLIST.md` — purchase, assembly, and rehearsal gates.

## Before submitting

Replace `[Student / team]`, `[Roll number(s)]`, `[College]`, `[Department]`, `[Guide]`, and `[Presentation date]` in the editable files. Adjust the report cover if your department provides a specific format. Add actual assembly photos and successful-withdrawal screenshots after physical testing. No hardware photograph or result has been fabricated.

The existing screenshot is an actual student-provided image of the earlier wrong-wallet failure. It is labelled as troubleshooting evidence in the report, not as proof of a successful withdrawal. Successful software transactions are separately documented from the saved simulator journal.

Edit the PPTX/DOCX directly in PowerPoint/Word or LibreOffice. Export new PDFs after changing them. The delivered PDFs were generated from the same source content; Office layout can vary slightly by installed fonts.

## Evidence

`evidence/` includes the automated-test log, web-build log, a snapshot of selected demo journal fields, and the unchanged supplied screenshot. All recorded payments used simulator mode. A saved local journal is evidence of the demo run, not independent public-chain verification.

Hardware status: Arduino CLI/ESP32 board packages and the physical components were unavailable in the implementation environment. Firmware compilation/upload, sensor recognition, and real servo motion must be verified on the bench. Record board/library versions and findings before changing this status.

## Regeneration (optional)

These tools are separate from the ATM application; they are not needed to run the demo. Generation overwrites the named presentation outputs, so keep manually edited versions separately.

1. Install Python 3 with ReportLab (`python3 -m pip install -r presentation/source/requirements.txt`).
2. Install document-only Node dependencies: `npm ci --prefix presentation/source`.
3. Run `python3 presentation/source/build_materials.py` to generate PDFs, DOCX, diagrams, and slide layout data.
4. Run `npm run slides --prefix presentation/source` to generate the PPTX from that layout data.

Python generation reads `source/report.json` and the frozen evidence snapshot. The slide deck is built from editable text and shapes, not flattened slide screenshots. Preferred font is DejaVu Sans; PDF generation requires the corresponding font files (on Linux: `/usr/share/fonts/truetype/dejavu`). Set `DEJAVU_FONT_DIR` if they are installed elsewhere.
