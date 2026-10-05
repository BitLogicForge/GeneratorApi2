import { fileURLToPath } from 'node:url';
import { PowerPointTemplateService } from './services/powerpoint-template.js';
import { TemplateReportDemoService } from './services/template-report-demo.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { WebPagePdfService } from './services/web-page-pdf.js';
import { GeneratedPresentationService } from './services/generated-presentation.js';
const config = loadConfig();
const pdf = new WebPagePdfService(config);
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
  pdf,
  presentations: new GeneratedPresentationService(),
}).listen(config.port, config.host, () =>
  console.log(`Generator API listening on ${config.host}:${config.port}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
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
