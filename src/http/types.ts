import type { Config } from '@/config';
import type { GenerationQueues } from '@/queue/generation-queue';
import type {
  PdfInput,
  PresentationInput,
  TemplatePresentationInput,
} from '@/schemas';

export interface AppOptions {
  templateReportDemo?: { generate(text?: string): Promise<Buffer> };
  pdf: {
    generate(input: PdfInput): Promise<Buffer>;
    readonly stats?: {
      state: string;
      launches: number;
      launchFailures: number;
      disconnects: number;
      active: number;
    };
  };
  presentations: {
    generate(template: string, input: PresentationInput): Promise<Buffer>;
  };
  templatePresentations?: {
    generate(
      template: string,
      input: TemplatePresentationInput,
    ): Promise<Buffer>;
  };
  config?: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>;
  queues?: GenerationQueues;
  logger?: Pick<Console, 'error'> & Partial<Pick<Console, 'info'>>;
  readiness?: () => {
    ready: boolean;
    shuttingDown: boolean;
    templates: string;
    renderer: string;
  };
}

export type RouteDependencies = AppOptions & {
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>;
  queues: GenerationQueues;
};
