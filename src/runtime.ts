import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import {
  LogEvent,
  RendererState,
  TemplateState,
} from './observability/constants.ts';
import { logTemplateValidationFailure } from './observability/template-validation.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { createReportServices } from './reports/services.ts';
import { WebPagePdfService } from './services/pdf/web-page-pdf.ts';

/** Starts shared infrastructure; report factories own their generation services. */
export function startServer() {
  const config = loadConfig();
  const pdf = new WebPagePdfService(config);
  const queues = createGenerationQueues({
    pdfConcurrency: config.concurrency,
    presentationConcurrency: config.presentationConcurrency,
    maxPending: config.maxPending,
    waitTimeoutMs: config.waitTimeoutMs,
  });
  const reports = createReportServices(config);
  let stopping = false;
  // Warm Chromium once; probes only inspect state. Failed launches can retry on a PDF request.
  void pdf
    .browser()
    .catch(() => console.error({ event: LogEvent.BrowserWarmupFailed }));
  const server = createApp({
    reports,
    readiness: () => ({
      ready:
        !stopping &&
        reports.stats.state === TemplateState.Ready &&
        pdf.stats.state === RendererState.Ready,
      shuttingDown: stopping,
      templates: reports.stats.state,
      renderer: pdf.stats.state,
    }),
    config,
    queues,
    pdf,
  }).listen(config.port, config.host, () =>
    console.log(`Generator API listening on ${config.host}:${config.port}`),
  );
  void reports
    .initialize()
    .catch((error: unknown) => logTemplateValidationFailure(error));
  /** Stops admission and drains active requests before closing Chromium, with a fixed exit deadline. */
  function shutdown() {
    if (stopping) return;
    stopping = true;
    queues.pdf.close();
    queues.presentations.close();
    const deadline = setTimeout(() => process.exit(1), 15000).unref();
    server.close(() => {
      Promise.all([pdf.close(), reports.close()]).then(
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
}
