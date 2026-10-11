import { chromium, errors } from 'playwright';

import { AppError } from '@/errors';

import type { Browser, BrowserContext } from 'playwright';
import type { Config } from '@/config';
import type { PdfInput } from '@/schemas';

export class WebPagePdfService {
  #browserPromise: Promise<Browser> | undefined;
  #active = 0;
  constructor(
    private readonly config: Pick<
      Config,
      'baseUrl' | 'concurrency' | 'timeout' | 'port'
    >,
  ) {}
  /** Shares one Chromium launch across requests and permits relaunch after failure or disconnect. */
  async browser() {
    if (!this.#browserPromise) {
      this.#browserPromise = chromium
        .launch()
        .then((browser) => {
          browser.on('disconnected', () => {
            this.#browserPromise = undefined;
          });
          return browser;
        })
        .catch((error) => {
          this.#browserPromise = undefined;
          throw error;
        });
    }
    return this.#browserPromise;
  }
  /** Prints in an isolated context, restricts navigation to the webapp, and always releases rendering resources. */
  async generate(input: PdfInput) {
    const url = new URL(input.route, this.config.baseUrl);
    if (url.origin !== this.config.baseUrl)
      throw new AppError(
        400,
        'INVALID_ROUTE',
        'Route must belong to the configured webapp',
      );
    for (const [key, value] of Object.entries(input.query))
      url.searchParams.set(key, String(value));
    if (this.#active >= this.config.concurrency)
      throw new AppError(503, 'RENDER_BUSY', 'Renderer is busy; retry shortly');
    this.#active++;
    let context: BrowserContext | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      context = await (
        await this.browser()
      ).newContext({ serviceWorkers: 'block' });
      await context.route('**/*', (route) => {
        const request = route.request();
        if (
          request.isNavigationRequest() &&
          new URL(request.url()).origin !== this.config.baseUrl
        )
          return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(this.config.timeout);
      return await Promise.race([
        (async () => {
          const response = await page.goto(url.href, { waitUntil: 'load' });
          if (!response || !response.ok())
            throw new AppError(
              502,
              'UPSTREAM_ERROR',
              'Webapp returned an unsuccessful response',
            );
          if (input.waitForSelector)
            await page
              .locator(input.waitForSelector)
              .waitFor({ state: 'visible' });
          await page.evaluate(() => document.fonts.ready);
          return page.pdf({
            format: input.format,
            landscape: input.landscape,
            printBackground: true,
            margin: {
              top: '12mm',
              right: '12mm',
              bottom: '12mm',
              left: '12mm',
            },
          });
        })(),
        new Promise<never>((resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new AppError(
                  504,
                  'RENDER_TIMEOUT',
                  'Webapp rendering timed out',
                ),
              ),
            this.config.timeout,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof errors.TimeoutError)
        throw new AppError(504, 'RENDER_TIMEOUT', 'Webapp rendering timed out');
      throw error;
    } finally {
      clearTimeout(timer);
      if (context) await context.close().catch(() => {});
      this.#active--;
    }
  }
  async close() {
    if (this.#browserPromise) await (await this.#browserPromise).close();
  }
}
