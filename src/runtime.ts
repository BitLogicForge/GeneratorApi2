import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { LogEvent } from './observability/constants.ts';
import { serializeError } from './observability/serialize-error.ts';
import { logTemplateValidationFailure } from './observability/template-validation.ts';
import { createGenerationQueues } from './queue/generation-queue.ts';
import { createReportServices } from './reports/services.ts';
import { WebPagePdfService } from './services/pdf/web-page-pdf.ts';

// Extra time after the render timeout for context cleanup and response flushing.
const SHUTDOWN_GRACE_MS = 5000;

/** Starts shared infrastructure; report factories own their generation services. */
export function startServer() {
  const config = loadConfig();
  const pdf = new WebPagePdfService(config);
  const queues = createGenerationQueues(config);
  const reports = createReportServices(config);
  let stopping = false;
  // Warm Chromium once; probes only inspect state. Failed launches can retry on a PDF request.
  void pdf
    .browser()
    .catch((error: unknown) =>
      console.error({ event: LogEvent.BrowserWarmupFailed, error: serializeError(error) }),
    );
  const server = createApp({
    reports,
    config,
    queues,
    pdf,
  }).listen(config.port, config.host, () =>
    console.log(`Generator API listening on ${config.host}:${config.port}`),
  );
  void reports.initialize().catch((error: unknown) => logTemplateValidationFailure(error));
  /**
   * Stops admission and drains active requests before closing Chromium. The exit deadline
   * outlasts the longest permitted render so active slots are never cut short.
   */
  function shutdown(signal: NodeJS.Signals) {
    if (stopping) return;
    stopping = true;
    const started = performance.now();
    const deadlineMs = config.timeout + SHUTDOWN_GRACE_MS;
    const queueStats = () => ({ pdf: queues.pdf.stats, presentations: queues.presentations.stats });
    console.log({ event: LogEvent.ShutdownStarted, signal, deadlineMs, queues: queueStats() });
    const drained = Promise.all([queues.pdf.close(), queues.presentations.close()]);
    const deadline = setTimeout(() => {
      console.error({
        event: LogEvent.ShutdownDeadlineExceeded,
        deadlineMs,
        queues: queueStats(),
        browser: pdf.stats,
      });
      process.exit(1);
    }, deadlineMs).unref();
    server.close(() => {
      drained
        .then(() => Promise.all([pdf.close(), reports.close()]))
        .then(
          () => {
            clearTimeout(deadline);
            console.log({
              event: LogEvent.ShutdownCompleted,
              durationMs: Math.round(performance.now() - started),
            });
          },
          (error: unknown) => {
            console.error({ event: LogEvent.ShutdownFailed, error: serializeError(error) });
            process.exitCode = 1;
          },
        );
    });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
