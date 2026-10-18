import { formatDateTime, generateTimeSeriesDates } from '@/utils/date-time';
import {
  generateRandomData,
  toSingleSeriesData,
  zipLabelsAndValues,
} from '@/utils/random-data';

import { PresentationService } from '../presentation-service.ts';
import { templateSettings } from './templateSettings.ts';

import type { Sample1RequestInput } from '@/routes/pptx/sample1/schema';
import type { TemplateDeck } from '../template-settings.ts';

const demoData = {
  timeseries: { rows: 9 },
  pie1: { rows: 5 },
  pie2: { rows: 8 },
  table4: { rows: 6, columns: 3 },
  table5: { rows: 7, columns: 5 },
} as const;

interface RawData {
  // date YYYY-MM-DD and value
  timeseries: { labels: string[]; values: number[] };
  pie1: { labels: string[]; values: number[] };
  pie2: { labels: string[]; values: number[] };
  table4: { values: number[][] };
  table5: { values: number[][] };
}

interface PreparedData {
  //text fields
  x1Title: string;
  x2Title: string;
  x3Title: string;
  x4Title: string;
  x1Sub: string;
  x1Text: string;

  tab1: {
    data: (number | string)[][];
  };
  chart1: {
    data: number[][];
    categories: string[];
  };
  tab2: {
    data: (number | string)[][];
  };
  chart2: {
    data: number[][];
    categories: string[];
  };
  tab3: (number | string)[][];
  chart3: {
    data: number[][];
    categories: string[];
  };

  table4: (number | string)[][];
  table5: (number | string)[][];
}

export class Sample1Service extends PresentationService<
  typeof templateSettings,
  Sample1RequestInput,
  RawData,
  PreparedData
> {
  constructor(path: string) {
    super(path, templateSettings);
  }

  /** Step 1: Fetches raw data from Data API (currently returning placeholder demo series). */
  protected fetchData(_input: Sample1RequestInput): RawData {
    // Placeholder for future Data API call.
    return {
      timeseries: {
        labels: generateTimeSeriesDates(demoData.timeseries.rows),
        values: generateRandomData(demoData.timeseries.rows, 1).flat(),
      },
      pie1: {
        labels: generateRandomData(demoData.pie1.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie1.rows, 1).flat(),
      },
      pie2: {
        labels: generateRandomData(demoData.pie2.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie2.rows, 1).flat(),
      },
      table4: {
        values: generateRandomData(
          demoData.table4.rows,
          demoData.table4.columns,
        ),
      },
      table5: {
        values: generateRandomData(
          demoData.table5.rows,
          demoData.table5.columns,
        ),
      },
    };
  }

  /** Step 2: Transforms request parameters and raw API data into presentation-ready values. */
  protected prepareData(
    input: Sample1RequestInput,
    raw: RawData,
  ): PreparedData {
    return {
      x1Title: "Page 1 Title",
      x2Title: "Page 2",
      x3Title: "Page 3",
      x4Title: "Page 4",
      x1Sub: formatDateTime(),
      x1Text: input.someText,
      tab1: {
        data: zipLabelsAndValues(raw.timeseries),
      },
      chart1: {
        data: toSingleSeriesData(raw.timeseries.values),
        categories: raw.timeseries.labels,
      },
      tab2: {
        data: zipLabelsAndValues(raw.pie1),
      },
      chart2: {
        data: toSingleSeriesData(raw.pie1.values),
        categories: raw.pie1.labels,
      },
      tab3: zipLabelsAndValues(raw.pie2),
      chart3: {
        data: toSingleSeriesData(raw.pie2.values),
        categories: raw.pie2.labels,
      },
      table4: raw.table4.values,
      table5: raw.table5.values,
    };
  }

  /** Step 3: Populates the PowerPoint template with prepared values. */
  protected async renderDeck(
    deck: TemplateDeck<typeof templateSettings>,
    prepared: PreparedData,
  ): Promise<void> {
    deck.texts.x1Title.fill(prepared.x1Title);
    deck.texts.x1Sub.fill(prepared.x1Sub);
    deck.texts.x1Text.fill(prepared.x1Text);
    deck.texts.x2Title.fill(prepared.x2Title);
    deck.texts.x3Title.fill(prepared.x3Title);
    deck.texts.x4Title.fill(prepared.x4Title);

    deck.tables.x2Tab1.fill(prepared.tab1.data, { resizeRows: true });
    deck.tables.x3Tab1.fill(prepared.tab2.data, { resizeRows: true });
    deck.tables.x3Tab2.fill(prepared.tab3, { resizeRows: true });

    await deck.charts.x2Chart1.fill(prepared.chart1.data, {
      categories: prepared.chart1.categories,
    });
    await deck.charts.x3Chart1.fill(prepared.chart2.data, {
      categories: prepared.chart2.categories,
    });
    await deck.charts.x3Chart2.fill(prepared.chart3.data, {
      categories: prepared.chart3.categories,
    });
    deck.tables.x4Tab1.fill(prepared.table4, { resizeRows: true });
    deck.tables.x4Tab2.fill(prepared.table5, { resizeRows: true });
  }
}
