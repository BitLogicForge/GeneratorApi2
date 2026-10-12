import { chromium, errors } from 'playwright';

import { AppError } from '@/errors';
import { RendererState } from '@/observability/constants';

import { pdfOriginSchema, resolvePdfPrintSettings } from './contracts.ts';
import { navigationBoundary } from './navigation-boundary.ts';

import type { Browser, BrowserContext } from 'playwright';
import type { Config } from '@/config';
import type { PdfRenderInput } from './contracts.ts';

export class WebPagePdfService {
  #browserPromise: Promise<Browser> | undefined;
  #active = 0;
  #state: RendererState = RendererState.Idle;
  #launches = 0;
  #launchFailures = 0;
  #disconnects = 0;
  get stats() {
    return {
      state: this.#state,
      launches: this.#launches,
      launchFailures: this.#launchFailures,
      disconnects: this.#disconnects,
      active: this.#active,
    };
  }
  constructor(
    private readonly config: Pick<
      Config,
      'baseUrl' | 'concurrency' | 'timeout' | 'port'
    > & { pdfPrint?: Config['pdfPrint'] },
  ) {}
  /** Shares one Chromium launch across requests and permits relaunch after failure or disconnect. */
  async browser() {
    if (!this.#browserPromise) {
      this.#state = RendererState.Starting;
      this.#browserPromise = chromium
        .launch()
        .then((browser) => {
          this.#launches++;
          this.#state = RendererState.Ready;
          browser.on('disconnected', () => {
            this.#disconnects++;
            this.#state = RendererState.Disconnected;
            this.#browserPromise = undefined;
          });
          return browser;
        })
        .catch((error) => {
          this.#launchFailures++;
          this.#state = RendererState.Failed;
          this.#browserPromise = undefined;
          throw error;
        });
    }
    return this.#browserPromise;
  }
  /** Prints in an isolated context, restricts navigation to the webapp, and always releases rendering resources. */
  async generate(input: PdfRenderInput, externalOrigin?: string) {
    const origin =
      externalOrigin === undefined
        ? this.config.baseUrl
        : pdfOriginSchema.parse(externalOrigin);
    const url = new URL(input.route, origin);
    if (url.origin !== origin)
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
      const page = await context.newPage();
      const { failure: navigationFailure } = await navigationBoundary(
        context,
        page,
        origin,
      );
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
          if (input.waitForNetworkIdle)
            await page.waitForLoadState('networkidle');
          const settings = resolvePdfPrintSettings(
            this.config.pdfPrint,
            input.print,
          );
          await page.emulateMedia({ media: settings.media });
          const styles = [settings.css];
          if (!settings.printImages)
            styles.push(
              'img, svg, canvas, video, picture, input[type="image"] { visibility: hidden !important; } * , *::before, *::after { background-image: none !important; list-style-image: none !important; border-image-source: none !important; }',
            );
          for (const selector of settings.hideSelectors)
            styles.push(`${selector} { display: none !important; }`);
          if (styles.some(Boolean))
            await page.addStyleTag({ content: styles.join('\n') });
          await page.evaluate(() => document.fonts.ready);
          return page.pdf({
            format: input.format,
            landscape: input.landscape,
            printBackground: settings.printBackground,
            scale: settings.scale,
            preferCSSPageSize: settings.preferCSSPageSize,
            displayHeaderFooter: settings.displayHeaderFooter,
            headerTemplate: settings.headerTemplate,
            footerTemplate: settings.footerTemplate,
            margin: Object.fromEntries(
              Object.entries(settings.margin).map(([side, mm]) => [
                side,
                `${mm}mm`,
              ]),
            ),
          });
        })(),
        navigationFailure,
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
