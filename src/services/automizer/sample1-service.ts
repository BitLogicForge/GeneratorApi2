import {
  modify,
  toAutomizerChartData,
  toAutomizerTableData,
} from '@/pptx/automizer';
import { formatDateTime, generateTimeSeriesDates } from '@/utils/date-time';
import {
  generateRandomData,
  toColumnCellColors,
  zipLabelsAndValues,
  zipLegendLabelsAndValues,
} from '@/utils/random-data';

import { AutomizerPresentationService } from './automizer-service.ts';

import type { Sample1RequestInput } from '@/routes/pptx/sample1/schema';
import type { PresentationBuilder } from './automizer-service.ts';

const demoData = {
  timeseries: { rows: 9 },
  pie1: { rows: 5, colorColumn: 0 },
  pie2: { rows: 8, colorColumn: 0 },
  table4: { rows: 6, columns: 3 },
  table5: { rows: 7, columns: 5 },
} as const;

interface RawData {
  timeseries: { labels: string[]; values: number[][] };
  pie1: { labels: string[]; values: number[][] };
  pie2: { labels: string[]; values: number[][] };
  table4: { values: number[][] };
  table5: { values: number[][] };
}

interface PreparedData {
  x1Title: string;
  x2Title: string;
  x3Title: string;
  x4Title: string;
  x1Sub: string;
  x1Text: string;
  duplicateSlide2: boolean;

  tab1: {
    data: (number | string)[][];
  };
  chart1: {
    data: number[][];
    categories: string[];
  };
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

export class Sample1Service extends AutomizerPresentationService<
  Sample1RequestInput,
  RawData,
  PreparedData
> {
  /** Step 1: Fetches raw demo data. */
  protected fetchData(_input: Sample1RequestInput): RawData {
    return {
      timeseries: {
        labels: generateTimeSeriesDates(demoData.timeseries.rows),
        values: generateRandomData(demoData.timeseries.rows, 1),
      },
      pie1: {
        labels: generateRandomData(demoData.pie1.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie1.rows, 1),
      },
      pie2: {
        labels: generateRandomData(demoData.pie2.rows, 1, 'string').flat(),
        values: generateRandomData(demoData.pie2.rows, 1),
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

  /** Step 2: Transforms request parameters and raw data into presentation-ready structures. */
  protected prepareData(
    input: Sample1RequestInput,
    raw: RawData,
  ): PreparedData {
    const pie1Colors = generateRandomData(
      raw.pie1.labels.length,
      1,
      'color',
    ).flat();
    const pie2Colors = generateRandomData(
      raw.pie2.labels.length,
      1,
      'color',
    ).flat();

    return {
      x1Title: input.title ?? 'Page 1 Title',
      x2Title: 'Page 2',
      x3Title: 'Page 3',
      x4Title: 'Page 4',
      x1Sub: formatDateTime(),
      x1Text: input.someText,
      duplicateSlide2: input.duplicateSlide2,
      tab1: {
        data: zipLabelsAndValues(raw.timeseries),
      },
      chart1: {
        data: raw.timeseries.values,
        categories: raw.timeseries.labels,
      },
      tab2: {
        data: zipLegendLabelsAndValues(raw.pie1, demoData.pie1.colorColumn),
        cellColors: toColumnCellColors(
          pie1Colors,
          3,
          demoData.pie1.colorColumn,
        ),
      },
      chart2: {
        data: raw.pie1.values,
        categories: raw.pie1.labels,
        colors: pie1Colors,
      },
      tab3: {
        data: zipLegendLabelsAndValues(raw.pie2, demoData.pie2.colorColumn),
        cellColors: toColumnCellColors(
          pie2Colors,
          3,
          demoData.pie2.colorColumn,
        ),
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

  /** Step 3: Populates template slides and duplicates slides using pptx-automizer. */
  protected renderPresentation(
    builder: PresentationBuilder,
    prepared: PreparedData,
  ): void {
    // Slide 1: Cover
    builder.addSlide(1, (slide) => {
      slide.modifyElement('X1_TITLE', modify.setText(prepared.x1Title));
      slide.modifyElement('X1_SUB', modify.setText(prepared.x1Sub));
      slide.modifyElement('X1_TEXT', modify.setText(prepared.x1Text));
    });

    // Slide 2: Timeseries Chart & Table
    builder.addSlide(2, (slide) => {
      slide.modifyElement('X2_TITLE', modify.setText(prepared.x2Title));
      slide.modifyElement('X2_TAB1', [
        modify.setTable(toAutomizerTableData(prepared.tab1.data), {
          adjustHeight: true,
        }),
      ]);
      slide.modifyElement('X2_CHART1', [
        modify.setChartData(
          toAutomizerChartData({
            categories: prepared.chart1.categories,
            data: prepared.chart1.data,
          }),
        ),
      ]);
    });

    // Duplicated Slide 2: Demonstrates pptx-automizer slide duplication
    if (prepared.duplicateSlide2) {
      builder.duplicateSlide(2, (slide) => {
        slide.modifyElement(
          'X2_TITLE',
          modify.setText(`${prepared.x2Title} (Duplicated Slide)`),
        );
        slide.modifyElement('X2_TAB1', [
          modify.setTable(toAutomizerTableData(prepared.tab1.data), {
            adjustHeight: true,
          }),
        ]);
        slide.modifyElement('X2_CHART1', [
          modify.setChartData(
            toAutomizerChartData({
              categories: prepared.chart1.categories,
              data: prepared.chart1.data,
            }),
          ),
        ]);
      });
    }

    // Slide 3: Two Pie Charts and Tables
    builder.addSlide(3, (slide) => {
      slide.modifyElement('X3_TITLE', modify.setText(prepared.x3Title));
      slide.modifyElement('X3_TAB1', [
        modify.setTable(
          toAutomizerTableData(prepared.tab2.data, prepared.tab2.cellColors),
          { adjustHeight: true },
        ),
      ]);
      slide.modifyElement('X3_CHART1', [
        modify.setChartData(
          toAutomizerChartData({
            categories: prepared.chart2.categories,
            data: prepared.chart2.data,
            colors: prepared.chart2.colors,
          }),
        ),
      ]);
      slide.modifyElement('X3_TAB2', [
        modify.setTable(
          toAutomizerTableData(prepared.tab3.data, prepared.tab3.cellColors),
          { adjustHeight: true },
        ),
      ]);
      slide.modifyElement('X3_CHART2', [
        modify.setChartData(
          toAutomizerChartData({
            categories: prepared.chart3.categories,
            data: prepared.chart3.data,
            colors: prepared.chart3.colors,
          }),
        ),
      ]);
    });

    // Slide 4: Data Tables
    builder.addSlide(4, (slide) => {
      slide.modifyElement('X4_TITLE', modify.setText(prepared.x4Title));
      slide.modifyElement('X4_TAB1', [
        modify.setTable(toAutomizerTableData(prepared.table4), {
          adjustHeight: true,
        }),
      ]);
      slide.modifyElement('X4_TAB2', [
        modify.setTable(toAutomizerTableData(prepared.table5), {
          adjustHeight: true,
        }),
      ]);
    });
  }
}
