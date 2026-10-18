import { mkdir, writeFile } from 'node:fs/promises';

import { Automizer } from 'pptx-automizer';

import {
  modify,
  toAutomizerChartData,
  toAutomizerTableData,
} from '@/pptx/automizer';

import type { ISlide } from 'pptx-automizer';

const automizer = new Automizer({
  removeExistingSlides: true,
  autoImportSlideMasters: true,
  cleanup: false,
  cleanupPlaceholders: false,
  verbosity: 0,
});

const pres = automizer
  .loadRoot('templates/daa.pptx')
  .load('templates/daa.pptx', 'template');

// Add original slide 1
pres.addSlide('template', 1, (slide: ISlide) => {
  slide.modifyElement('TEXT_ME', modify.setText('First Slide (Original)'));
  slide.modifyElement('TAB100', [
    modify.setTable(
      toAutomizerTableData([
        ['A1', 'B1', 'C1', 'D1'],
        ['A2', 'B2', 'C2', 'D2'],
      ]),
      { adjustHeight: true },
    ),
  ]);
  slide.modifyElement('GGO', [
    modify.setChartData(
      toAutomizerChartData({
        categories: ['Jan', 'Feb', 'Mar'],
        data: [
          [10, 20, 30],
          [15, 25, 35],
          [20, 30, 40],
        ],
      }),
    ),
  ]);
});

// Duplicate slide 1 with distinct data and content
pres.addSlide('template', 1, (slide: ISlide) => {
  slide.modifyElement(
    'TEXT_ME',
    modify.setText('Second Slide (Duplicated from Slide 1!)'),
  );
  slide.modifyElement('TAB100', [
    modify.setTable(toAutomizerTableData([['X1', 'Y1', 'Z1', 'W1']]), {
      adjustHeight: true,
    }),
  ]);
  slide.modifyElement('GGO', [
    modify.setChartData(
      toAutomizerChartData({
        categories: ['Q1', 'Q2', 'Q3'],
        data: [
          [100, 200, 300],
          [150, 250, 350],
          [200, 300, 400],
        ],
      }),
    ),
  ]);
});

const zip = await pres.getJSZip();
await mkdir('output/automizer', { recursive: true });
await writeFile(
  'output/automizer/duplicate-slide.pptx',
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
);
console.log(
  'Saved duplicated slide presentation to output/automizer/duplicate-slide.pptx',
);
