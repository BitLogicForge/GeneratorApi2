import { createRandomDataGenerator } from '@/utils/random-data';

import { TemplateSource } from './template-source.ts';

import type { DaaRequestInput } from '@/routes/pptx/daa/schema';
import type { TemplateSettings } from './template-settings.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
const templateSettings = {
  tables: {
    table: {
      name: 'TAB100',
      options: {
        startRow: 1,
      },
    },
  },
  charts: {
    chart: {
      name: 'GGO',
    },
  },
  texts: {
    text: {
      name: 'TEXT_ME',
    },
  },
} satisfies TemplateSettings;

const demoData = {
  table: { rows: 3, columns: 4 },
  chart: { rows: 20, series: 3, categoryPrefix: 'A' },
} as const;

export class DaaPocPresentationService {
  private readonly source: TemplateSource<typeof templateSettings>;
  private readonly generateTableData: (rows: number) => number[][];
  private readonly generateChartData: (rows: number) => number[][];

  constructor(path: string, nextNumber?: () => number) {
    this.generateTableData = createRandomDataGenerator(
      demoData.table.columns,
      nextNumber,
    );
    this.generateChartData = createRandomDataGenerator(
      demoData.chart.series,
      nextNumber,
    );
    this.source = new TemplateSource(path, templateSettings);
  }

  async validate() {
    await this.source.load();
  }

  /** Populates named template objects with demo data while retaining native editable tables and charts. */
  async generate(input: DaaRequestInput): Promise<Buffer> {
    const deck = await this.source.open();
    const tableData = this.generateTableData(demoData.table.rows);
    const chartData = this.generateChartData(demoData.chart.rows);

    deck.tables.table.fill(tableData);
    deck.texts.text.fill(input.TEXT_ME);
    await deck.charts.chart.fill(chartData, {
      categories: chartData.map(
        (_, index) => `${demoData.chart.categoryPrefix}${index + 1}`,
      ),
    });

    return deck.toBuffer();
  }
}
