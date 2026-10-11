import { randomInt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { findNamedObjects } from './objects.ts';
import { fillTable, fillTextShape } from './text-table.ts';
import { fillCategoryChart } from './charts.ts';
import { writeXml } from './package.ts';

export class TemplateReportDemoService {
  constructor(
    private readonly path: string,
    private readonly nextNumber: () => number = () => randomInt(1, 101),
  ) {}

  /** Populates named template objects with demo data while retaining native editable tables and charts. */
  async generate(text = 'Generated report'): Promise<Buffer> {
    const zip = await JSZip.loadAsync(await readFile(this.path));
    const { slides, objects } = await findNamedObjects(zip, [
      'TAB100',
      'GGO',
      'TEXT_ME',
    ]);
    const table = objects.get('TAB100')!;
    const chart = objects.get('GGO')!;
    const textShape = objects.get('TEXT_ME')!;
    const tableData = Array.from({ length: 3 }, () =>
      Array.from({ length: 4 }, () => this.nextNumber()),
    );

    fillTable(table.element, tableData, { startRow: 1 });
    fillTextShape(textShape.element, text);
    const chartData = Array.from({ length: 20 }, () =>
      Array.from({ length: 3 }, () => this.nextNumber()),
    );
    await fillCategoryChart(zip, chart, chartData, {
      categories: Array.from({ length: 20 }, (_, index) => `A${index + 1}`),
    });
    for (const path of new Set([table.path, textShape.path]))
      writeXml(zip, path, slides.get(path)!);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }
}
