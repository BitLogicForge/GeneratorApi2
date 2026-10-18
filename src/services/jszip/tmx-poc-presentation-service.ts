import { randomInt } from 'node:crypto';

import { DateTimeFormat, formatDateTime } from '@/utils/date-time';
import { createRandomDataGenerator } from '@/utils/random-data';

import { PresentationService } from './presentation-service.ts';

import type { TmaRequestInput } from '@/routes/pptx/tma/schema';
import type { PresentationServiceOptions } from './presentation-service.ts';
import type { TemplateDeck, TemplateSettings } from './template-settings.ts';

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

interface TmaRawData {
  asOf: Date;
  chartA: number[][];
  chartB: number[][];
}

interface TmaPreparedData {
  texts: {
    text0: string;
    text1: string;
    text2: string;
    subtitle: string;
  };
  chartA: {
    data: number[][];
    categories: string[];
  };
  chartB: {
    data: number[][];
    colors: string[];
  };
}

export class TmxPocPresentationService extends PresentationService<
  typeof templateSettings,
  TmaRequestInput,
  TmaRawData,
  TmaPreparedData
> {
  private readonly generateData: (rows: number) => number[][];

  constructor(path: string, options: PresentationServiceOptions = {}) {
    super(path, templateSettings, options);
    this.generateData = createRandomDataGenerator(1);
  }

  /** Step 1: Fetches raw data from Data API (currently returning placeholder demo series). */
  protected fetchData(input: TmaRequestInput): TmaRawData {
    console.debug({
      PP1: input.PP1,
      PP2: input.PP2,
      dataApiConfigured: Boolean(this.dataApi),
    });
    // Placeholder for future Data API call via `this.dataApi`.
    return {
      asOf: new Date(),
      chartA: this.generateData(demoData.chartA.rows),
      chartB: this.generateData(demoData.chartB.rows),
    };
  }

  /** Step 2: Transforms request parameters and raw API data into presentation-ready values. */
  protected prepareData(
    input: TmaRequestInput,
    raw: TmaRawData,
  ): TmaPreparedData {
    // Dates YYYY-MM-DD from asOf backwards.
    const categories = Array.from({ length: raw.chartA.length }, (_, index) => {
      const date = new Date(raw.asOf);
      date.setUTCDate(date.getUTCDate() - index);
      return formatDateTime(date, { format: DateTimeFormat.Date });
    });

    const colors = raw.chartB.map(() =>
      randomInt(0x1000000).toString(16).padStart(6, '0'),
    );

    return {
      texts: {
        text0: input.TEXT_ME,
        text1: 'CHART A',
        text2: 'CHART B',
        subtitle: formatDateTime(raw.asOf),
      },
      chartA: {
        data: raw.chartA,
        categories,
      },
      chartB: {
        data: raw.chartB,
        colors,
      },
    };
  }

  /** Step 3: Populates the PowerPoint template with prepared values. */
  protected async renderDeck(
    deck: TemplateDeck<typeof templateSettings>,
    prepared: TmaPreparedData,
  ): Promise<void> {
    deck.texts.text0.fill(prepared.texts.text0);
    deck.texts.text1.fill(prepared.texts.text1);
    deck.texts.text2.fill(prepared.texts.text2);
    deck.texts.subtitle.fill(prepared.texts.subtitle);

    await deck.charts.chartA.fill(prepared.chartA.data, {
      categories: prepared.chartA.categories,
    });
    await deck.charts.chartB.fill(prepared.chartB.data, {
      colors: prepared.chartB.colors,
    });
  }
}
