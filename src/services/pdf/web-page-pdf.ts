import { chromium, errors } from 'playwright';

import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { RendererState } from '@/observability/constants';
import { requestCancelled } from '@/queue/cancellation';
import { buildUrl } from '@/utils/url';

import { PdfErrorMessage } from './constants.ts';
import { navigationBoundary } from './navigation-boundary.ts';
import { renderPagePdf } from './render-page.ts';
import { pdfOriginSchema } from './schema.ts';

import type { Browser, BrowserContext } from 'playwright';
import type { Config } from '@/config';
import type { RenderPhase } from './render-page.ts';
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
    private readonly config: Pick<Config, 'baseUrl' | 'timeout' | 'port'> & {
      pdfPrint?: Config['pdfPrint'];
      allowHttp404?: boolean;
      pdfLogRequests?: boolean;
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
        .launch({ timeout: this.config.timeout })
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

  /**
   * Prints in an isolated context and restricts navigation to the webapp. The render timeout
   * covers the whole pipeline, browser launch included. Concurrency is bounded by the PDF queue.
   */
  async generate(input: PdfRenderInput, externalOrigin?: string, signal?: AbortSignal) {
    const origin =
      externalOrigin === undefined ? this.config.baseUrl : pdfOriginSchema.parse(externalOrigin);
    const url = buildUrl(origin, input.route, {
      params: input.params,
      query: input.query,
    });
    if (url.origin !== origin)
      throw new AppError(400, ErrorCode.InvalidRoute, PdfErrorMessage.InvalidRoute, {
        details: { route: input.route, resolvedUrl: url.href, allowedOrigin: origin },
      });
    this.#active++;
    const started = performance.now();
    let phase: RenderPhase = 'launch';
    let finished = false;
    let context: BrowserContext | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const diagnostics = () => ({
      url: url.href,
      phase,
      timeoutMs: this.config.timeout,
      elapsedMs: Math.round(performance.now() - started),
      browserState: this.#state,
    });
    const render = async () => {
      const browser = await this.browser();
      phase = 'context';
      const created = await browser.newContext({ serviceWorkers: 'block' });
      // The timeout or a disconnect may have won the race while the context was being created.
      if (finished) {
        await created.close().catch(() => {});
        return Promise.reject(new Error('Render already settled'));
      }
      context = created;
      const page = await context.newPage();
      const { failure: navigationFailure } = await navigationBoundary(context, page, origin);
      page.setDefaultTimeout(this.config.timeout);
      return Promise.race([
        renderPagePdf(page, url, input, this.config.pdfPrint, {
          allowHttp404: input.allowHttp404 ?? this.config.allowHttp404 ?? false,
          logger: this.logger,
          logRequests: this.config.pdfLogRequests ?? true,
          onPhase: (next) => (phase = next),
        }),
        navigationFailure,
      ]);
    };
    try {
      return await Promise.race([
        render(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new AppError(504, ErrorCode.RenderTimeout, PdfErrorMessage.RenderTimeout, {
                  details: diagnostics(),
                }),
              ),
            this.config.timeout,
          );
        }),
        new Promise<never>((_resolve, reject) => {
          if (!signal) return;
          onAbort = () => reject(requestCancelled(`pdf:${phase}`));
          if (signal.aborted) onAbort();
          else signal.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
    } catch (error) {
      if (error instanceof errors.TimeoutError)
        throw new AppError(504, ErrorCode.RenderTimeout, PdfErrorMessage.RenderTimeout, {
          cause: error,
          details: diagnostics(),
        });
      if (error instanceof AppError) throw error;
      throw new AppError(500, ErrorCode.InternalError, `PDF rendering failed during ${phase}`, {
        cause: error,
        details: diagnostics(),
      });
    } finally {
      finished = true;
      clearTimeout(timer);
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      // Closing the context stops any in-flight page work before the queue slot is released.
      if (context) await context.close().catch(() => {});
      this.#active--;
    }
  }

  async close() {
    if (this.#browserPromise) await (await this.#browserPromise).close();
  }
}
