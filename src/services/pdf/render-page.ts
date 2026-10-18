import { ErrorCode, ErrorMessage } from '@/constants';
import { AppError } from '@/errors';

import { HIDE_IMAGES_CSS } from './constants.ts';
import { resolvePdfPrintSettings } from './schema.ts';

import type { Page } from 'playwright';
import type { PdfPrintSettings, PdfRenderInput } from './schema.ts';

/** Navigates an isolated page, applies print media/style overrides, and prints to PDF. */
export async function renderPagePdf(
  page: Page,
  url: URL,
  input: PdfRenderInput,
  defaultPrintSettings?: PdfPrintSettings,
): Promise<Buffer> {
  const response = await page.goto(url.href, { waitUntil: 'load' });
  if (!response || !response.ok()) {
    throw new AppError(
      502,
      ErrorCode.UpstreamError,
      ErrorMessage.UpstreamError,
    );
  }
  if (input.waitForSelector) {
    await page.locator(input.waitForSelector).waitFor({ state: 'visible' });
  }
  if (input.waitForNetworkIdle) {
    await page.waitForLoadState('networkidle');
  }
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
      Object.entries(settings.margin).map(([side, mm]) => [side, `${mm}mm`]),
    ),
  });
}
