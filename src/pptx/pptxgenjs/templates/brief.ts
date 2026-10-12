import type pptxgen from 'pptxgenjs';
import type { BriefInput } from '@/services/pptxgenjs/contracts';
export function briefTemplate(deck: pptxgen, input: BriefInput) {
  const cover = deck.addSlide();
  cover.background = { color: '0F172A' };
  cover.addShape(deck.ShapeType.rect, {
    x: 0.65,
    y: 1.3,
    w: 0.12,
    h: 4.7,
    fill: { color: input.accent },
    line: { color: input.accent },
  });
  cover.addText('PROJECT BRIEF', {
    x: 1,
    y: 1.35,
    w: 11.3,
    h: 0.4,
    color: input.accent,
    fontSize: 14,
    charSpacing: 4,
  });
  cover.addText(input.title, {
    x: 1,
    y: 2.05,
    w: 11.3,
    h: 2.4,
    color: 'FFFFFF',
    fontSize: 42,
    bold: true,
    fit: 'shrink',
  });
  cover.addText(input.subtitle, {
    x: 1,
    y: 4.65,
    w: 11.3,
    h: 0.9,
    color: 'CBD5E1',
    fontSize: 20,
    fit: 'shrink',
  });
  cover.addText(input.author, {
    x: 1,
    y: 6.5,
    w: 11,
    h: 0.3,
    color: '94A3B8',
    fontSize: 11,
  });
  input.slides.forEach((content, index) => {
    const slide = deck.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addShape(deck.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.12,
      fill: { color: input.accent },
      line: { color: input.accent },
    });
    slide.addText(content.title, {
      x: 0.8,
      y: 0.6,
      w: 11.7,
      h: 1.1,
      color: '0F172A',
      fontSize: 30,
      bold: true,
      fit: 'shrink',
    });
    content.bullets.forEach((text, i) => {
      const y = 2 + i * 0.68;
      slide.addText(String(i + 1).padStart(2, '0'), {
        x: 0.85,
        y,
        w: 0.6,
        h: 0.52,
        color: input.accent,
        bold: true,
        fontSize: 16,
      });
      slide.addText(text, {
        x: 1.65,
        y,
        w: 10.8,
        h: 0.56,
        color: '334155',
        fontSize: 19,
        fit: 'shrink',
      });
    });
    slide.addText(input.title, {
      x: 0.8,
      y: 7,
      w: 10.5,
      h: 0.25,
      color: '64748B',
      fontSize: 10,
      fit: 'shrink',
    });
    slide.addText(`${index + 2} / ${input.slides.length + 1}`, {
      x: 11.7,
      y: 7,
      w: 0.8,
      h: 0.25,
      color: '64748B',
      fontSize: 10,
      align: 'right',
    });
    if (content.notes) slide.addNotes(content.notes);
  });
}
