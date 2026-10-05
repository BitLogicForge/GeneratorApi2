import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { PdfService } from './services/pdf.js';
import { PresentationService } from './services/presentation.js';
const config = loadConfig();
const pdf = new PdfService(config);
const server = createApp({ pdf, presentations: new PresentationService() }).listen(config.port,
  () => console.log(`Generator API: http://localhost:${config.port}`));
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 15000).unref();
  server.close(async () => {
    try { await pdf.close(); clearTimeout(deadline); }
    catch (error) { console.error(error); process.exitCode = 1; }
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
