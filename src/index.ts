import { fileURLToPath } from 'node:url';

import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import {
  LogEvent,
  RendererState,
  TemplateState,
} from './observability/constants.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { DaaPocPresentationService } from './services/jszip/daa-poc-presentation-service.ts';
import { PowerPointTemplateService } from './services/jszip/power-point-template-service.ts';
import { WebPagePdfService } from './services/pdf/web-page-pdf.ts';
import { PowerPointGenerationService } from './services/pptxgenjs/power-point-generation-service.ts';

const config = loadConfig();
const pdf = new WebPagePdfService(config);
const queues = createGenerationQueues({
  pdfConcurrency: config.concurrency,
  presentationConcurrency: config.presentationConcurrency,
  maxPending: config.maxPending,
  waitTimeoutMs: config.waitTimeoutMs,
});
const templatePresentations = new PowerPointTemplateService({
  summary: fileURLToPath(new URL('../templates/summary.pptx', import.meta.url)),
  business: fileURLToPath(
    new URL('../templates/business.pptx', import.meta.url),
  ),
});
const templateReportDemo = new DaaPocPresentationService(
  fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
);
let stopping = false;
let templates: TemplateState = TemplateState.Validating;
Promise.all([
  templatePresentations.validate(),
  templateReportDemo.validate(),
]).then(
  () => {
    templates = TemplateState.Ready;
  },
  () => {
    templates = TemplateState.Failed;
    console.error({ event: LogEvent.TemplateValidationFailed });
  },
);
// Warm Chromium once; probes only inspect state. Failed launches can retry on a PDF request.
void pdf
  .browser()
  .catch(() => console.error({ event: LogEvent.BrowserWarmupFailed }));
const server = createApp({
  templateReportDemo,
  readiness: () => ({
    ready:
      !stopping &&
      templates === TemplateState.Ready &&
      pdf.stats.state === RendererState.Ready,
    shuttingDown: stopping,
    templates,
    renderer: pdf.stats.state,
  }),
  config,
  templatePresentations,
  queues,
  pdf,
  presentations: new PowerPointGenerationService(),
}).listen(config.port, config.host, () =>
  console.log(`Generator API listening on ${config.host}:${config.port}`),
);
/** Stops admission and drains active requests before closing Chromium, with a fixed exit deadline. */
function shutdown() {
  if (stopping) return;
  stopping = true;
  queues.pdf.close();
  queues.presentations.close();
  const deadline = setTimeout(() => process.exit(1), 15000).unref();
  server.close(() => {
    pdf.close().then(
      () => clearTimeout(deadline),
      (error: unknown) => {
        console.error(error);
        process.exitCode = 1;
      },
    );
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
