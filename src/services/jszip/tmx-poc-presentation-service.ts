import { loadConfig } from '@/config';
import { DataApiClient } from '@/services/data-api-client';
import { DateTimeFormat, formatDateTime } from '@/utils/date-time';

import { PresentationService } from './presentation-service.ts';

import type {
  TmaBreakdownData,
  TmaSeriesData,
} from '@/data-api/tma-data-schema';
import type { TmaRequestInput } from '@/routes/pptx/tma/schema';
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

interface TmaRawData {
  series: TmaSeriesData;
  breakdown: TmaBreakdownData;
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
  constructor(path: string) {
    super(path, templateSettings);
  }

  /** Step 1: Fetches raw series and breakdown data from the Data API using PP1 and PP2. */
  protected async fetchData(input: TmaRequestInput): Promise<TmaRawData> {
    console.debug({ PP1: input.PP1, PP2: input.PP2 });
    const config = loadConfig();
    const api = new DataApiClient(config.dataApi);
    const [series, breakdown] = await Promise.all([
      api.get('tmaSeries', {}, { pp1: input.PP1 }),
      api.get('tmaBreakdown', {}, { pp2: input.PP2 }),
    ]);
    return { series, breakdown };
  }

  /** Step 2: Transforms request parameters and raw API data into presentation-ready values. */
  protected prepareData(
    input: TmaRequestInput,
    raw: TmaRawData,
  ): TmaPreparedData {
    const asOf = new Date(raw.series.asOf);
    // Dates YYYY-MM-DD from asOf backwards.
    const categories = Array.from(
      { length: raw.series.values.length },
      (_, index) => {
        const date = new Date(asOf);
        date.setUTCDate(date.getUTCDate() - index);
        return formatDateTime(date, { format: DateTimeFormat.Date });
      },
    );

    return {
      texts: {
        text0: input.TEXT_ME,
        text1: raw.series.title,
        text2: raw.breakdown.title,
        subtitle: formatDateTime(asOf),
      },
      chartA: {
        data: raw.series.values,
        categories,
      },
      chartB: {
        data: raw.breakdown.values,
        colors: raw.breakdown.colors,
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
