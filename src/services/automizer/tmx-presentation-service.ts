import { loadConfig } from '@/config';
import { modify, toAutomizerChartData } from '@/pptx/automizer';
import { DataApiClient } from '@/services/data-api-client';
import { DateTimeFormat, formatDateTime } from '@/utils/date-time';

import { AutomizerPresentationService } from './automizer-service.ts';

import type {
  TmaBreakdownData,
  TmaSeriesData,
} from '@/data-api/tma-data-schema';
import type { TmaRequestInput } from '@/routes/pptx/tma/schema';
import type { PresentationBuilder } from './automizer-service.ts';

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

export class TmxPresentationService extends AutomizerPresentationService<
  TmaRequestInput,
  TmaRawData,
  TmaPreparedData
> {
  /** Step 1: Fetches raw series and breakdown data from the Data API using PP1 and PP2. */
  protected async fetchData(input: TmaRequestInput): Promise<TmaRawData> {
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

  /** Step 3: Populates template slides using declarative pptx-automizer modifiers. */
  protected renderPresentation(
    builder: PresentationBuilder,
    prepared: TmaPreparedData,
  ): void {
    // Slide 1: Cover text & subtitle placeholder token
    builder.addSlide(1, (slide) => {
      slide.modifyElement('X_T0', modify.setText(prepared.texts.text0));
      slide.modifyElement(
        'X_SUB',
        modify.replaceText([
          { replace: 'ASOF', by: { text: prepared.texts.subtitle } },
        ]),
      );
    });

    // Slide 2: Series title and timeseries chart
    builder.addSlide(2, (slide) => {
      slide.modifyElement('X_T1', modify.setText(prepared.texts.text1));
      slide.modifyElement(
        'X_CHART_A',
        modify.setChartData(
          toAutomizerChartData({
            categories: prepared.chartA.categories,
            data: prepared.chartA.data,
          }),
        ),
      );
    });

    // Slide 3: Breakdown title and pie chart with custom slice colors
    builder.addSlide(3, (slide) => {
      slide.modifyElement('X_T2', modify.setText(prepared.texts.text2));
      slide.modifyElement(
        'X_CHART_B',
        modify.setChartData(
          toAutomizerChartData({
            data: prepared.chartB.data,
            colors: prepared.chartB.colors,
          }),
        ),
      );
    });
  }
}
