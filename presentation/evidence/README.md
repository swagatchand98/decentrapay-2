# Evidence provenance

Prepared 26 October 2026 (Asia/Kolkata).

| File | Source | What it establishes |
|---|---|---|
| `automated-tests.txt` | Fresh `npm test` output in this repository | 17 passing isolated software tests; no physical device used |
| `web-build.txt` | Fresh `npm run build` output | Browser assets build successfully |
| `demo-snapshot.json` | Selected fields copied from the existing local deployment and dispensing journal | Three completed simulator requests and two failed scan cases were saved |
| `wallet-mismatch.png` | Unchanged screenshot supplied by the student in the conversation | Earlier selected-account mismatch and zero test balance; NOT a success screenshot |

The user subsequently confirmed that withdrawals work after importing the correct local test account. The saved completed requests have amounts Rs 100, Rs 500, and Rs 200, with block numbers 2, 3, and 4 in that local deployment. No live public explorer verification is claimed; the development chain can be reset.

No fingerprint images/templates or private wallet keys were copied into this evidence pack. Transaction hashes and wallet addresses belong to the public local test setup.

## Still required from the actual bench

- Successful Arduino compilation/upload output and the board/library versions used.
- An assembled-hardware photograph, with actual wiring and component labels visible.
- A successful full-flow screenshot and transaction hash for each physical acceptance run.
- Observer/date notes for real fingerprint recognition and servo/LED movement.
- Optional 60–90 second recording of an actual successful physical run.

Use `../physical-acceptance.csv` and `../Bench-Checklist.pdf`. Do not replace pending fields using simulator observations.

## File validation

The preparation script renders the PDFs from the same source content as the Office artifacts. PDF page counts and layout previews were inspected. DOCX/PPTX package XML and content were checked. Native Word/PowerPoint rendering could not be previewed here: the installed LibreOffice headless process exited before conversion. Open the editable versions on the presentation laptop, then export fresh PDFs after entering student details.
