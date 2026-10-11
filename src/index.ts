import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { DaaPocPresentationService } from './services/jszip/daa-poc-presentation-service.ts';
import { PowerPointTemplateService } from './services/jszip/power-point-template-service.ts';
import { WebPagePdfService } from './services/pdf/web-page-pdf.ts';
import { PowerPointGenerationService } from './services/pptxgenjs/power-point-generation-service.ts';
import { loadTemplateCatalog } from './templates/catalog.ts';

const config = loadConfig();
const catalog = await loadTemplateCatalog();
const pdf = new WebPagePdfService(config);
const queues = createGenerationQueues({
  pdfConcurrency: config.concurrency,
  presentationConcurrency: config.presentationConcurrency,
  maxPending: config.maxPending,
  waitTimeoutMs: config.waitTimeoutMs,
});
const templatePresentations = new PowerPointTemplateService(
  Object.fromEntries(
    catalog
      .filter((entry) => entry.definition.mode === 'placeholders')
      .map((entry) => [entry.definition.id, entry.path]),
  ),
);
const server = createApp({
  templateCatalog: catalog.map((entry) => entry.metadata),
  templateReportDemo: catalog.some((entry) => entry.definition.id === 'daa')
    ? new DaaPocPresentationService(
        catalog.find((entry) => entry.definition.id === 'daa')!.path,
      )
    : undefined,
  config,
  templatePresentations,
  queues,
  pdf,
  presentations: new PowerPointGenerationService(),
}).listen(config.port, config.host, () =>
  console.log(`Generator API listening on ${config.host}:${config.port}`),
);
let stopping = false;
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
