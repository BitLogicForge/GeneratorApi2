import { randomInt } from 'node:crypto';

import { DateTimeFormat, formatDateTime } from '@/utils/date-time';
import { createRandomDataGenerator } from '@/utils/random-data';

import { TemplateSource } from './template-source.ts';

import type { TmaRequestInput } from '@/routes/pptx/tma/schema';
import type { TemplateSettings } from './template-settings.ts';

// Configure the authored template here; names are PowerPoint Selection Pane names.
const templateSettings = {
  charts: {
    chartA: {
      name: 'X_CHART_A',
      options: {
        firstRow: 2,
      },
    },
    chartB: {
      name: 'X_CHART_B',
      options: {
        firstColumn: 'B',
        firstRow: 2,
      },
    },
  },
  texts: {
    text0: {
      name: 'X_T0',
    },
    text1: {
      name: 'X_T1',
    },
    text2: {
      name: 'X_T2',
    },
    subtitle: {
      name: 'X_SUB',
      options: {
        replace: '{{ASOF}}',
      },
    },
  },
} satisfies TemplateSettings;

const demoData = {
  chartA: { rows: 20 },
  chartB: { rows: 4 },
} as const;

export class TmxPocPresentationService {
  private readonly source: TemplateSource<typeof templateSettings>;
  private readonly generateData: (rows: number) => number[][];

  constructor(path: string, nextNumber?: () => number) {
    this.generateData = createRandomDataGenerator(1, nextNumber);
    this.source = new TemplateSource(path, templateSettings);
  }

  async validate() {
    await this.source.load();
  }

  /** Populates named template objects with demo data while retaining native editable tables and charts. */
  async generate(input: TmaRequestInput): Promise<Buffer> {
    console.debug({ PP1: input.PP1, PP2: input.PP2 });
    const deck = await this.source.open();
    const now = new Date();

    deck.texts.text0.fill(input.TEXT_ME);
    deck.texts.text1.fill('CHART A');
    deck.texts.text2.fill('CHART B');
    deck.texts.subtitle.fill(formatDateTime(now));

    const chartDataA = this.generateData(demoData.chartA.rows);
    //dates YYYY-MM-DD from today backwards
    const chartRowsNames = Array.from(
      { length: demoData.chartA.rows },
      (_, index) => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - index);
        return formatDateTime(date, { format: DateTimeFormat.Date });
      },
    );

    await deck.charts.chartA.fill(chartDataA, {
      categories: chartRowsNames,
    });

    const chartDataB = this.generateData(demoData.chartB.rows);
    const colors = chartDataB.map(() =>
      randomInt(0x1000000).toString(16).padStart(6, '0'),
    );
    await deck.charts.chartB.fill(chartDataB, {
      colors,
    });

    return deck.toBuffer();
  }
}
