import type { RequestHandler } from 'express';
import type { Config } from '@/config';
import type { ReadinessState, RendererState } from '@/observability/constants';
import type { GenerationQueues } from '@/queue/generation-queue';
import type { ReportServices } from '@/reports/services';
import type { PdfRenderInput } from '@/services/pdf/schema';
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
  config?: Pick<Config, 'defaultLanguage'> &
    Partial<
      Pick<
        Config,
        | 'concurrency'
        | 'presentationConcurrency'
        | 'maxPending'
        | 'waitTimeoutMs'
        | 'baseUrl'
        | 'allowHttp404'
        | 'logIgnoreUnmatched'
        | 'logExcludeRoutes'
        | 'pdfLogRequests'
      >
    >;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'> & Partial<Pick<Console, 'info' | 'warn'>>;
  readiness?: () => ReadinessState;
}

export type RouteDependencies = AppOptions & {
  observability: Pick<ReturnType<typeof createObservability>, 'snapshot'>;
  config: Pick<Config, 'defaultLanguage'> & Partial<Pick<Config, 'baseUrl' | 'allowHttp404'>>;
  queues: GenerationQueues;
};

export type RouteFactory = (
  dependencies: RouteDependencies,
) => RequestHandler<Record<string, string>>;
