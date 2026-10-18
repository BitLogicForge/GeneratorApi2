import JSZip from 'jszip';

import { fillCategoryChart } from '@/pptx/jszip/charts';
import { findNamedObjects } from '@/pptx/jszip/objects';
import { writeXml } from '@/pptx/jszip/package/write-xml';
import { fillTable } from '@/pptx/jszip/tables/fill';
import { fillTextShape } from '@/pptx/jszip/text/fill-shape';
import { createRandomDataGenerator } from '@/utils/random-data';

import { TemplateSource } from './template-source.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
const templateSettings = {
  objects: {
    table: 'TAB100',
    chart: 'GGO',
    text: 'TEXT_ME',
  },
  table: { rows: 3, columns: 4, startRow: 1 },
  chart: { rows: 20, series: 3, categoryPrefix: 'A' },
};
const objectNames = Object.values(templateSettings.objects);

export class DaaPocPresentationService {
  private readonly source: TemplateSource;
  private readonly generateTableData: (rows: number) => number[][];
  private readonly generateChartData: (rows: number) => number[][];

  constructor(path: string, nextNumber?: () => number) {
    this.generateTableData = createRandomDataGenerator(
      templateSettings.table.columns,
      nextNumber,
    );
    this.generateChartData = createRandomDataGenerator(
      templateSettings.chart.series,
      nextNumber,
    );
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
    const table = objects.get(templateSettings.objects.table)!;
    const chart = objects.get(templateSettings.objects.chart)!;
    const textShape = objects.get(templateSettings.objects.text)!;
    const tableData = this.generateTableData(templateSettings.table.rows);

    fillTable(table.element, tableData, {
      startRow: templateSettings.table.startRow,
    });
    fillTextShape(textShape.element, text);
    const chartData = this.generateChartData(templateSettings.chart.rows);
    await fillCategoryChart(zip, chart, chartData, {
      categories: chartData.map(
        (_, index) => `${templateSettings.chart.categoryPrefix}${index + 1}`,
      ),
    });
    for (const [path, document] of slides) writeXml(zip, path, document);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
