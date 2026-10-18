import { mkdir, writeFile } from 'node:fs/promises';

import { Automizer } from 'pptx-automizer';

import {
  modify,
  setTable,
  toAutomizerChartData,
  toAutomizerTableData,
} from '@/pptx/automizer';

import type { ISlide } from 'pptx-automizer';

const automizer = new Automizer({
  removeExistingSlides: true,
  autoImportSlideMasters: false,
  cleanup: true,
  cleanupPlaceholders: false,
  verbosity: 0,
});

const pres = automizer
  .loadRoot('templates/daa.pptx')
  .load('templates/daa.pptx', 'template');

// Add original slide 1: uses setTable to automatically preserve the template's header row
pres.addSlide('template', 1, (slide: ISlide) => {
  slide.modifyElement('TEXT_ME', modify.setText('First Slide (Original)'));
  slide.modifyElement('TAB100', [
    setTable(
      [
        ['A1', 'B1', 'C1', 'D1'],
        ['A2', 'B2', 'C2', 'D2'],
      ],
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

// Duplicate slide 1: demonstrates complete table replacement from row 0 using toAutomizerTableData
pres.addSlide('template', 1, (slide: ISlide) => {
  slide.modifyElement(
    'TEXT_ME',
    modify.setText('Second Slide (Duplicated from Slide 1!)'),
  );
  slide.modifyElement('TAB100', [
    modify.setTable(
      toAutomizerTableData([
        ['Col 1', 'Col 2', 'Col 3', 'Col 4'],
        ['X1', 'Y1', 'Z1', 'W1'],
      ]),
      { adjustHeight: true },
    ),
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
