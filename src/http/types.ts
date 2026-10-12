import type { Config } from '@/config';
import type { ReadinessState, RendererState } from '@/observability/constants';
import type { GenerationQueues } from '@/queue/generation-queue';
import type { ReportServices } from '@/reports/services';
import type { PptxRenderInput } from '@/services/jszip/contracts';
import type { PdfRenderInput } from '@/services/pdf/contracts';
import type { BriefInput } from '@/services/pptxgenjs/contracts';
import type { createObservability } from './observability.ts';

export interface AppOptions {
  reports?: ReportServices;
  templateReportDemo?: { generate(text?: string): Promise<Buffer> };
  pdf: {
    generate(input: PdfRenderInput): Promise<Buffer>;
    readonly stats?: {
      state: RendererState;
      launches: number;
      launchFailures: number;
      disconnects: number;
      active: number;
    };
  };
  presentations?: {
    generate(template: string, input: BriefInput): Promise<Buffer>;
  };
  templatePresentations?: {
    generate(template: string, input: PptxRenderInput): Promise<Buffer>;
  };
  config?: Pick<Config, 'documentRoutes' | 'defaultLanguage'>;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'> & Partial<Pick<Console, 'info'>>;
  readiness?: () => ReadinessState;
}

export type RouteDependencies = AppOptions & {
  observability: Pick<ReturnType<typeof createObservability>, 'snapshot'>;
  config: Pick<Config, 'documentRoutes' | 'defaultLanguage'>;
  queues: GenerationQueues;
};
