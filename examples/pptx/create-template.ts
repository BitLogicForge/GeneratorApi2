import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';

// Run once to create the sample; the API subsequently reads this actual PPTX file.
const deck = new pptxgen();
deck.layout = 'LAYOUT_WIDE';
const slide = deck.addSlide();
slide.background = { color: '0F172A' };
slide.addText('{{title}}', {
  x: 0.8,
  y: 1.6,
  w: 11.7,
  h: 1.5,
  fontSize: 40,
  bold: true,
  color: 'FFFFFF',
  fit: 'shrink',
});
slide.addText('{{subtitle}}', {
  x: 0.8,
  y: 3.4,
  w: 11.7,
  h: 1,
  fontSize: 22,
  color: 'CBD5E1',
  fit: 'shrink',
});
slide.addText('Prepared for {{customer}}', {
  x: 0.8,
  y: 6.3,
  w: 11.7,
  h: 0.4,
  fontSize: 14,
  color: '60A5FA',
});
slide.addNotes('Presenting to {{customer}}');
await deck.writeFile({
  fileName: fileURLToPath(new URL('../../templates/business.pptx', import.meta.url)),
});
