import { chromium, errors } from 'playwright';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { RendererState } from '@/observability/constants';
import { buildUrl } from '@/utils/url';

import { PdfErrorMessage } from './constants.ts';
import { navigationBoundary } from './navigation-boundary.ts';
import { renderPagePdf } from './render-page.ts';
import { pdfOriginSchema } from './schema.ts';

import type { Browser, BrowserContext } from 'playwright';
import type { Config } from '@/config';
import type { PdfRenderInput } from './schema.ts';

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
    private readonly config: Pick<Config, 'baseUrl' | 'concurrency' | 'timeout' | 'port'> & {
      pdfPrint?: Config['pdfPrint'];
      allowHttp404?: boolean;
      pdfLogRequests?: boolean;
      logVerbose?: boolean;
    },
    private readonly logger: {
      info?: (event: unknown) => void;
      warn?: (event: unknown) => void;
    } = console,
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
      externalOrigin === undefined ? this.config.baseUrl : pdfOriginSchema.parse(externalOrigin);
    const url = buildUrl(origin, input.route, {
      params: input.params,
      query: input.query,
    });
    if (url.origin !== origin)
      throw new AppError(400, ErrorCode.InvalidRoute, PdfErrorMessage.InvalidRoute);
    if (this.#active >= this.config.concurrency)
      throw new AppError(503, ErrorCode.RenderBusy, PdfErrorMessage.RenderBusy);
    this.#active++;
    let context: BrowserContext | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      context = await (await this.browser()).newContext({ serviceWorkers: 'block' });
      const page = await context.newPage();
      const { failure: navigationFailure } = await navigationBoundary(context, page, origin);
      page.setDefaultTimeout(this.config.timeout);
      const allowHttp404 = input.allowHttp404 ?? this.config.allowHttp404 ?? false;
      const logRequests = this.config.pdfLogRequests ?? true;
      return await Promise.race([
        renderPagePdf(page, url, input, this.config.pdfPrint, {
          allowHttp404,
          logger: this.logger,
          logRequests,
        }),
        navigationFailure,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new AppError(504, ErrorCode.RenderTimeout, PdfErrorMessage.RenderTimeout)),
            this.config.timeout,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof errors.TimeoutError)
        throw new AppError(504, ErrorCode.RenderTimeout, PdfErrorMessage.RenderTimeout);
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
