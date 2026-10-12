import { randomInt } from 'node:crypto';

import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';


import { replaceParagraphText } from '@/pptx/jszip/text/replace-paragraph-text';
import { TemplateSource } from './template-source.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
const templateSettings = {
  objects: {

    chartA: 'X_CHART_A',
    chartB: 'X_CHART_B',
    text0: 'X_T0',
    text1: 'X_T1',
    text2: 'X_T2',
    subtitile: "X_SUB"
  },
  chartA: { rows: 20, series: 1 },
  chartB: { rows: 4, series: 1 },
};
const objectNames = Object.values(templateSettings.objects);

export class TmxPocPresentationService {
  private readonly source: TemplateSource;
  constructor(
    path: string,
    private readonly nextNumber: () => number = () => randomInt(1, 101),
  ) {
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

    const date = new Date().toISOString().split('T')[0];
    const time = new Date()
      .toISOString()
      .split('T')[1]
      .split(':')
      .slice(0, 2)
      .join(':');

    fillTextShape(text0.element, text);
    fillTextShape(text1.element, "CHART A");
    fillTextShape(text2.element, "CHART B");



    const subtitile = objects.get(templateSettings.objects.subtitile)!;
    replaceParagraphText(subtitile.element, '{{ASOF}}', date + ' ' + time);

    /// Generate chart data for the category chart
    ///  random values from 1 to 100
    const chartDataA = Array.from({ length: templateSettings.chartA.rows }, () =>
      Array.from({ length: templateSettings.chartA.series }, () =>
        this.nextNumber(),
      ),
    );
    //dates YYYY-MM-DD from today backwards
    const chartRowsNames = Array.from({ length: templateSettings.chartA.rows }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - index);
      return date.toISOString().split('T')[0];
    });

    await fillCategoryChart(zip, chartA, chartDataA, {
      categories: chartRowsNames, firstRow: 2,


    });

    const chartDataB = Array.from({ length: templateSettings.chartB.rows }, () =>
      Array.from({ length: templateSettings.chartB.series }, () =>
        this.nextNumber(),
      ),
    );


    await fillCategoryChart(zip, chartB, chartDataB, { firstColumn: "B", firstRow: 2 });

    for (const path of new Set([chartA.path, chartB.path, text0.path, text1.path, text2.path, subtitile.path]))
      writeXml(zip, path, slides.get(path)!);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
