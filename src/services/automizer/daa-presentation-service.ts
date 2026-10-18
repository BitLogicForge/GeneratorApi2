import {
  modify,
  toAutomizerChartData,
  toAutomizerTableData,
} from '@/pptx/automizer';
import { generateRandomData } from '@/utils/random-data';

import { AutomizerPresentationService } from './automizer-service.ts';

import type { DaaRequestInput } from '@/routes/pptx/daa/schema';
import type { PresentationBuilder } from './automizer-service.ts';

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

export class DaaPresentationService extends AutomizerPresentationService<
  DaaRequestInput,
  DaaRawData,
  DaaPreparedData
> {
  /** Step 1: Fetches raw data from Data API (currently returning placeholder demo series). */
  protected fetchData(_input: DaaRequestInput): DaaRawData {
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

  /** Step 3: Populates template slide elements using declarative pptx-automizer modifiers. */
  protected renderPresentation(
    builder: PresentationBuilder,
    prepared: DaaPreparedData,
  ): void {
    builder.addSlide(1, (slide) => {
      slide.modifyElement('TEXT_ME', modify.setText(prepared.text));
      slide.modifyElement('TAB100', [
        modify.setTable(toAutomizerTableData(prepared.table), {
          adjustHeight: true,
        }),
      ]);
      slide.modifyElement('GGO', [
        modify.setChartData(
          toAutomizerChartData({
            categories: prepared.chart.categories,
            data: prepared.chart.data,
          }),
        ),
      ]);
    });
  }
}
