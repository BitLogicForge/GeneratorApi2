import { generateRandomData } from '@/utils/random-data';

import { PresentationService } from './presentation-service.ts';

import type { DaaRequestInput } from '@/routes/pptx/daa/schema';
import type { TemplateDeck, TemplateSettings } from './template-settings.ts';

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

interface DaaRawData {
  table: number[][];
  chart: number[][];
}

interface DaaPreparedData {
  text: string;
  table: number[][];
  chart: {
    data: number[][];
    categories: string[];
  };
}

export class DaaPocPresentationService extends PresentationService<
  typeof templateSettings,
  DaaRequestInput,
  DaaRawData,
  DaaPreparedData
> {
  constructor(path: string) {
    super(path, templateSettings);
  }

  /** Step 1: Fetches raw data from Data API (currently returning placeholder demo series). */
  protected fetchData(_input: DaaRequestInput): DaaRawData {
    // Placeholder for future Data API call.
    return {
      table: generateRandomData(demoData.table.rows, demoData.table.columns),
      chart: generateRandomData(demoData.chart.rows, demoData.chart.series),
    };
  }

  /** Step 2: Transforms request parameters and raw API data into presentation-ready values. */
  protected prepareData(
    input: DaaRequestInput,
    raw: DaaRawData,
  ): DaaPreparedData {
    return {
      text: input.TEXT_ME,
      table: raw.table,
      chart: {
        data: raw.chart,
        categories: raw.chart.map(
          (_, index) => `${demoData.chart.categoryPrefix}${index + 1}`,
        ),
      },
    };
  }

  /** Step 3: Populates the PowerPoint template with prepared values. */
  protected async renderDeck(
    deck: TemplateDeck<typeof templateSettings>,
    prepared: DaaPreparedData,
  ): Promise<void> {
    deck.tables.table.fill(prepared.table);
    deck.texts.text.fill(prepared.text);
    await deck.charts.chart.fill(prepared.chart.data, {
      categories: prepared.chart.categories,
    });
  }
}
