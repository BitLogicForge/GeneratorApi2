import { fileURLToPath } from 'node:url';
import { TemplatePresentationService } from './services/template-presentation.js';
import { DaaPresentationService } from './services/daa-presentation.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PdfService } from './services/pdf.js';
import { PresentationService } from './services/presentation.js';
import { createGenerationQueues } from './queue/generation-queue.js';
const config = loadConfig();
const pdf = new PdfService(config);
const queues = createGenerationQueues({
  pdfConcurrency: config.concurrency,
  presentationConcurrency: config.presentationConcurrency,
  maxPending: config.maxPending,
  waitTimeoutMs: config.waitTimeoutMs,
});
const templatePresentations = new TemplatePresentationService({
  business: fileURLToPath(
    new URL('../templates/business.pptx', import.meta.url),
  ),
});
const server = createApp({
  daaPresentations: new DaaPresentationService(
    fileURLToPath(new URL('../templates/daa.pptx', import.meta.url)),
  ),
  defaultLanguage: config.defaultLanguage,
  pdfRoutePattern: config.pdfRoutePattern,
  templatePresentations,
  queues,
  pdf,
  presentations: new PresentationService(),
}).listen(config.port, config.host, () =>
  console.log(`Generator API listening on ${config.host}:${config.port}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  queues.pdf.close();
  queues.presentations.close();
  const deadline = setTimeout(() => process.exit(1), 15000).unref();
  server.close(async () => {
    try {
      await pdf.close();
      clearTimeout(deadline);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
