// Editable PowerPoint from the same geometry/text used to render the slide PDF.
const fs = require('node:fs');
const path = require('node:path');
const pptxgen = require('pptxgenjs');
const dir = path.resolve(__dirname, '..');
const deck = JSON.parse(fs.readFileSync(path.join(__dirname, 'slide-layout.json'), 'utf8'));
const pptx = new pptxgen();
pptx.defineLayout({ name: 'DEMO', width: deck.width, height: deck.height });
pptx.layout = 'DEMO';
pptx.author = 'DecentraPay project';
pptx.subject = 'College Web3 ATM prototype; physical hardware verification pending';
pptx.title = 'DecentraPay — Decentralized ATM System Using Web3';
pptx.company = '[College]';
pptx.lang = 'en-IN';
pptx.theme = { headFontFace: 'DejaVu Sans', bodyFontFace: 'DejaVu Sans', lang: 'en-IN' };
for (const spec of deck.slides) {
  const slide = pptx.addSlide();
  slide.background = { color: spec.background };
  for (const e of spec.elements) {
    if (e.type === 'box') {
      slide.addShape(pptx.ShapeType.rect, { x: e.x, y: e.y, w: e.w, h: e.h,
        line: { color: e.fill, transparency: 100 }, fill: { color: e.fill }, radius: 0 });
    } else if (e.type === 'line') {
      slide.addShape(pptx.ShapeType.line, { x: e.x, y: e.y, w: e.w, h: e.h || 0,
        line: { color: e.color, width: e.width || 1.2, ...(e.arrow ? { endArrowType: 'triangle' } : {}) } });
    } else if (e.type === 'text') {
      slide.addText(e.text, { x: e.x, y: e.y, w: e.w, h: e.h, fontFace: 'DejaVu Sans',
        fontSize: e.size, color: e.color, bold: Boolean(e.bold), margin: 0,
        breakLine: false, valign: 'top', align: e.align || 'left',
        paraSpaceAfterPt: 0, lineSpacingMultiple: 1.08 });
    }
  }
  slide.addNotes(spec.notes);
}
pptx.writeFile({ fileName: path.join(dir, 'DecentraPay-Presentation.pptx') });
