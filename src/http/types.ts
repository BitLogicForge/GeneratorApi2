import type { Config } from '../config.js';
import type {
  PdfInput,
  PresentationInput,
  TemplatePresentationInput,
} from '../types.js';

export interface AppOptions {
  templateReportDemo?: { generate(text?: string): Promise<Buffer> };
  pdf: { generate(input: PdfInput): Promise<Buffer> };
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
}

export type RouteDependencies = AppOptions & {
  config: Pick<Config, 'pdfRoutePattern' | 'defaultLanguage'>;
};
