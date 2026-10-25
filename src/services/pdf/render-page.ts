import { ErrorCode } from '@/constants';
import { AppError } from '@/errors';
import { LogEvent } from '@/observability/constants';

import { HIDE_IMAGES_CSS, PdfErrorMessage } from './constants.ts';
import { resolvePdfPrintSettings } from './schema.ts';

import type { Page } from 'playwright';
import type { PdfPrintSettings, PdfRenderInput } from './schema.ts';

export interface RenderPagePdfOptions {
  allowHttp404?: boolean;
  logger?: {
    info?: (event: unknown) => void;
    warn?: (event: unknown) => void;
  };
  logRequests?: boolean;
  /** Reports the current step so timeouts and failures can name where rendering stopped. */
  onPhase?: (phase: RenderPhase) => void;
}

export type RenderPhase =
  | 'launch'
  | 'context'
  | 'navigate'
  | 'waitForSelector'
  | 'waitForNetworkIdle'
  | 'applyStyles'
  | 'waitForFonts'
  | 'print';

/** Navigates an isolated page, applies print media/style overrides, and prints to PDF. */
export async function renderPagePdf(
  page: Page,
  url: URL,
  input: PdfRenderInput,
  defaultPrintSettings?: PdfPrintSettings,
  options: RenderPagePdfOptions = {},
): Promise<Buffer> {
  const { allowHttp404 = false, logger, logRequests = true, onPhase } = options;
  if (logRequests) {
    logger?.info?.({
      event: LogEvent.PdfPageRequested,
      url: url.href,
    });
  }
  const started = performance.now();
  let response;
  onPhase?.('navigate');
  try {
    response = await page.goto(url.href, { waitUntil: 'load' });
  } catch (error) {
    if (logRequests) {
      logger?.warn?.({
        event: LogEvent.PdfPageNavigationFailed,
        url: url.href,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
  const status = response?.status();
  const ok = response ? response.ok() || (allowHttp404 && status === 404) : false;
  if (!response || !ok) {
    if (logRequests) {
      logger?.warn?.({
        event: LogEvent.PdfPageNavigationFailed,
        url: url.href,
        status: status ?? null,
        allowHttp404,
      });
    }
    throw new AppError(502, ErrorCode.UpstreamError, PdfErrorMessage.UpstreamError, {
      details: {
        url: url.href,
        status: status ?? null,
        statusText: response?.statusText() ?? null,
        allowHttp404,
        reason: response ? 'unsuccessful_status' : 'no_response',
      },
    });
  }
  if (logRequests) {
    logger?.info?.({
      event: LogEvent.PdfPageLoaded,
      url: url.href,
      status,
      durationMs: Math.round(performance.now() - started),
    });
  }
  if (input.waitForSelector) {
    onPhase?.('waitForSelector');
    await page.locator(input.waitForSelector).waitFor({ state: 'visible' });
  }
  if (input.waitForNetworkIdle) {
    onPhase?.('waitForNetworkIdle');
    await page.waitForLoadState('networkidle');
  }
  onPhase?.('applyStyles');
  const settings = resolvePdfPrintSettings(defaultPrintSettings, input.print);
  await page.emulateMedia({ media: settings.media });
  const styles = [settings.css];
  if (!settings.printImages) {
    styles.push(HIDE_IMAGES_CSS);
  }
  for (const selector of settings.hideSelectors) {
    styles.push(`${selector} { display: none !important; }`);
  }
  if (styles.some(Boolean)) {
    await page.addStyleTag({ content: styles.join('\n') });
  }
  onPhase?.('waitForFonts');
  await page.evaluate(() => document.fonts.ready);
  onPhase?.('print');
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
      Object.entries(settings.margin).map(([side, mm]) => [side, `${mm}mm`]),
    ),
  });
}
