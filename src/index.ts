import { fileURLToPath } from 'node:url';
import { PowerPointTemplateService } from './pptx/jszip/powerpoint-template.ts';
import { TemplateReportDemoService } from './pptx/jszip/template-report-demo.ts';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { WebPagePdfService } from './services/web-page-pdf.ts';
import { GeneratedPresentationService } from './pptx/pptxgenjs/generated-presentation.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
const config = loadConfig();
const pdf = new WebPagePdfService(config);
const queues = createGenerationQueues({
  pdfConcurrency: config.concurrency,
  presentationConcurrency: config.presentationConcurrency,
  maxPending: config.maxPending,
  waitTimeoutMs: config.waitTimeoutMs,
});
const templatePresentations = new PowerPointTemplateService({
  business: fileURLToPath(
    new URL('../templates/business.pptx', import.meta.url),
  ),
});
const server = createApp({
  templateReportDemo: new TemplateReportDemoService(
    fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
  ),
  config,
  templatePresentations,
  queues,
  pdf,
  presentations: new GeneratedPresentationService(),
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
