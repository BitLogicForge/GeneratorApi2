import { randomInt } from 'node:crypto';

import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';
import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';
import { formatDateTime } from '@/utils/date-time';
import { createRandomDataGenerator } from '@/utils/random-data';

import { TemplateSource } from './template-source.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
const templateSettings = {
  objects: {
    chartA: 'X_CHART_A',
    chartB: 'X_CHART_B',
    text0: 'X_T0',
    text1: 'X_T1',
    text2: 'X_T2',
    subtitile: 'X_SUB',
  },
  chartA: { rows: 20 },
  chartB: { rows: 4 },
};
const objectNames = Object.values(templateSettings.objects);

export class TmxPocPresentationService {
  private readonly source: TemplateSource;
  private readonly generateData: (rows: number) => number[][];

  constructor(path: string, nextNumber?: () => number) {
    this.generateData = createRandomDataGenerator(1, nextNumber);
    this.source = new TemplateSource(path, async (zip) => {
      await findNamedObjects(zip, objectNames);
    });
  }

  async validate() {
    await this.source.load();
  }

  /** Populates named template objects with demo data while retaining native editable tables and charts. */
  async generate(text = 'Generated report'): Promise<Buffer> {
    const zip = await JSZip.loadAsync(await this.source.load());
    const { slides, objects } = await findNamedObjects(zip, objectNames);
    const chartA = objects.get(templateSettings.objects.chartA)!;
    const chartB = objects.get(templateSettings.objects.chartB)!;
    const text0 = objects.get(templateSettings.objects.text0)!;
    const text1 = objects.get(templateSettings.objects.text1)!;
    const text2 = objects.get(templateSettings.objects.text2)!;

    const now = new Date();

    fillTextShape(text0.element, text);
    fillTextShape(text1.element, 'CHART A');
    fillTextShape(text2.element, 'CHART B');

    const subtitile = objects.get(templateSettings.objects.subtitile)!;
    replaceParagraphText(subtitile.element, '{{ASOF}}', formatDateTime(now));

    const chartDataA = this.generateData(templateSettings.chartA.rows);
    //dates YYYY-MM-DD from today backwards
    const chartRowsNames = Array.from(
      { length: templateSettings.chartA.rows },
      (_, index) => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - index);
        return formatDateTime(date, { format: 'date' });
      },
    );

    await fillCategoryChart(zip, chartA, chartDataA, {
      categories: chartRowsNames,
      firstRow: 2,
    });

    const chartDataB = this.generateData(templateSettings.chartB.rows);

    const colors = chartDataB.map(() =>
      randomInt(0x1000000).toString(16).padStart(6, '0'),
    );
    await fillCategoryChart(zip, chartB, chartDataB, {
      firstColumn: 'B',
      firstRow: 2,
      colors,
    });

    for (const [path, document] of slides) writeXml(zip, path, document);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
