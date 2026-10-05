import { chromium, type Browser } from 'playwright';
import type { Config } from '../config.js';
import type { PdfInput } from '../types.js';

export class WebPagePdfService {
  private browserPromise?: Promise<Browser>;
  constructor(private readonly config: Pick<Config, 'baseUrl' | 'timeout'>) {}

  async generate(input: PdfInput) {
    const url = new URL(input.route, this.config.baseUrl);
    for (const [key, value] of Object.entries(input.query))
      url.searchParams.set(key, String(value));
    this.browserPromise ??= chromium.launch();
    const context = await (await this.browserPromise).newContext();
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeout);
      await page.goto(url.href, { waitUntil: 'load' });
      if (input.waitForSelector)
        await page.locator(input.waitForSelector).waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      return await page.pdf({
        format: input.format,
        landscape: input.landscape,
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
    } finally {
      await context.close();
    }
  }

  async close() {
    if (this.browserPromise) await (await this.browserPromise).close();
  }
}
