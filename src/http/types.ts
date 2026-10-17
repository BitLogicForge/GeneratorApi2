import type { Config } from '@/config';
import type { ReadinessState, RendererState } from '@/observability/constants';
import type { GenerationQueues } from '@/queue/generation-queue';
import type { ReportServices } from '@/reports/services';
import type { PdfRenderInput } from '@/services/pdf/contracts';
import type { createObservability } from './observability.ts';

export interface AppOptions {
  reports?: ReportServices;
  pdf: {
    generate(input: PdfRenderInput, externalOrigin?: string): Promise<Buffer>;
    readonly stats?: {
      state: RendererState;
      launches: number;
      launchFailures: number;
      disconnects: number;
      active: number;
    };
  };
  config?: Pick<Config, 'defaultLanguage'>;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'> & Partial<Pick<Console, 'info'>>;
  readiness?: () => ReadinessState;
}

export type RouteDependencies = AppOptions & {
  observability: Pick<ReturnType<typeof createObservability>, 'snapshot'>;
  config: Pick<Config, 'defaultLanguage'>;
  queues: GenerationQueues;
};
