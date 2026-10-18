import { formatDateTime, generateTimeSeriesDates } from '@/utils/date-time';
import {
  generateRandomData,
  toColumnCellColors,
  zipLabelsAndValues,
  zipLegendLabelsAndValues,
} from '@/utils/random-data';

import { PresentationService } from '../presentation-service.ts';
import { templateSettings } from './templateSettings.ts';

import type { Sample1RequestInput } from '@/routes/pptx/sample1/schema';
import type { SlideHandle, TemplateDeck } from '../template-settings.ts';

const demoData = {
  slide2Instances: 5,
  timeseriesRows: 9,
  pie1: { rows: 5, colorColumn: 0 },
  pie2: { rows: 8, colorColumn: 0 },
  table4: { rows: 6, columns: 3 },
  table5: { rows: 7, columns: 5 },
} as const;

interface Slide2RawData {
  title: string;
  timeseries: { labels: string[]; values: number[][] };
}

interface RawData {
  slides2: Slide2RawData[];
  pie1: { labels: string[]; values: number[][] };
  pie2: { labels: string[]; values: number[][] };
  table4: { values: number[][] };
  table5: { values: number[][] };
}

interface Slide2PreparedData {
  title: string;
  tab1: {
    data: (number | string)[][];
  };
  chart1: {
    data: number[][];
    categories: string[];
  };
}

interface PreparedData {
  //text fields
  x1Title: string;
  slides2: Slide2PreparedData[];
  x3Title: string;
  x4Title: string;
  x1Sub: string;
  x1Text: string;

  tab2: {
    data: (number | string)[][];
    cellColors: (string | undefined)[][];
  };
  chart2: {
    data: number[][];
    categories: string[];
    colors: string[];
  };
  tab3: {
    data: (number | string)[][];
    cellColors: (string | undefined)[][];
  };
  chart3: {
    data: number[][];
    categories: string[];
    colors: string[];
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
      slides2: Array.from({ length: demoData.slide2Instances }, (_, index) => ({
        title: index === 0 ? 'Page 2' : `Page 2 (Duplicate ${index})`,
        timeseries: {
          labels: generateTimeSeriesDates(demoData.timeseriesRows),
          values: generateRandomData(demoData.timeseriesRows, 1),
        },
      })),
      pie1: {
        labels: generateRandomData(demoData.pie1.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie1.rows, 1),
      },
      pie2: {
        labels: generateRandomData(demoData.pie2.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie2.rows, 1),
      },
      table4: {
        values: generateRandomData(demoData.table4.rows, demoData.table4.columns),
      },
      table5: {
        values: generateRandomData(demoData.table5.rows, demoData.table5.columns),
      },
    };
  }

  /** Step 2: Transforms request parameters and raw API data into presentation-ready values. */
  protected prepareData(input: Sample1RequestInput, raw: RawData): PreparedData {
    const pie1Colors = generateRandomData(raw.pie1.labels.length, 1, 'color').flat();
    const pie2Colors = generateRandomData(raw.pie2.labels.length, 1, 'color').flat();

    return {
      x1Title: 'Page 1 Title',
      slides2: raw.slides2.map((item) => ({
        title: item.title,
        tab1: {
          data: zipLabelsAndValues(item.timeseries),
        },
        chart1: {
          data: item.timeseries.values,
          categories: item.timeseries.labels,
        },
      })),
      x3Title: 'Page 3',
      x4Title: 'Page 4',
      x1Sub: formatDateTime(),
      x1Text: input.someText,
      tab2: {
        data: zipLegendLabelsAndValues(raw.pie1, demoData.pie1.colorColumn),
        cellColors: toColumnCellColors(pie1Colors, 3, demoData.pie1.colorColumn),
      },
      chart2: {
        data: raw.pie1.values,
        categories: raw.pie1.labels,
        colors: pie1Colors,
      },
      tab3: {
        data: zipLegendLabelsAndValues(raw.pie2, demoData.pie2.colorColumn),
        cellColors: toColumnCellColors(pie2Colors, 3, demoData.pie2.colorColumn),
      },
      chart3: {
        data: raw.pie2.values,
        categories: raw.pie2.labels,
        colors: pie2Colors,
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
    // Page 1
    deck.texts.x1Title.fill(prepared.x1Title);
    const x1TitleCopy = deck.texts.x1Title.clone();
    x1TitleCopy.move({ dy: -2 });
    x1TitleCopy.fill('xxx');
    deck.texts.x1Sub.fill(prepared.x1Sub);
    deck.texts.x1Text.fill(prepared.x1Text);

    // Page 2 & duplicates
    const duplicates = await deck.duplicateSlide(2, prepared.slides2.length - 1);
    const page2Slides: SlideHandle<typeof templateSettings>[] = [
      await deck.getSlide(2),
      ...duplicates,
    ];

    for (const [index, slide] of page2Slides.entries()) {
      const slideData = prepared.slides2[index];
      if (!slideData) continue;
      slide.texts.x2Title.fill(slideData.title);
      slide.tables.x2Tab1.fill(slideData.tab1.data, { resizeRows: true });
      await slide.charts.x2Chart1.fill(slideData.chart1.data, {
        categories: slideData.chart1.categories,
      });
    }

    // Page 3 & Page 4
    deck.texts.x3Title.fill(prepared.x3Title);
    deck.texts.x4Title.fill(prepared.x4Title);

    deck.tables.x3Tab1.fill(prepared.tab2.data, {
      resizeRows: true,
      cellColors: prepared.tab2.cellColors,
    });
    deck.tables.x3Tab2.fill(prepared.tab3.data, {
      resizeRows: true,
      cellColors: prepared.tab3.cellColors,
    });

    await deck.charts.x3Chart1.fill(prepared.chart2.data, {
      categories: prepared.chart2.categories,
      colors: prepared.chart2.colors,
    });
    await deck.charts.x3Chart2.fill(prepared.chart3.data, {
      categories: prepared.chart3.categories,
      colors: prepared.chart3.colors,
    });
    deck.tables.x4Tab1.fill(prepared.table4, { resizeRows: true });
    deck.tables.x4Tab2.fill(prepared.table5, { resizeRows: true });
  }
}
