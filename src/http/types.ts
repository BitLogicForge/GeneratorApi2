import type { Config } from '@/config';
import type { ReadinessState, RendererState } from '@/observability/constants';
import type { GenerationQueues } from '@/queue/generation-queue';
import type { PdfRenderInput } from '@/routes/api/exports/pdf/schema';
import type { PptxRenderInput } from '@/routes/api/exports/pptx/jszip/schema';
import type { BriefInput } from '@/routes/api/exports/pptx/pptxgenjs/brief/schema';
import type { createObservability } from './observability.ts';

export interface AppOptions {
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
  presentations: {
    generate(template: string, input: BriefInput): Promise<Buffer>;
  };
  templatePresentations?: {
    generate(template: string, input: PptxRenderInput): Promise<Buffer>;
  };
  config?: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'> & Partial<Pick<Console, 'info'>>;
  readiness?: () => ReadinessState;
}

export type RouteDependencies = AppOptions & {
  observability: Pick<ReturnType<typeof createObservability>, 'snapshot'>;
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>;
  queues: GenerationQueues;
};
