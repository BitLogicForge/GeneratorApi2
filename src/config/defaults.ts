import { PdfFormat, PdfMedia } from '@/services/pdf/constants';

import type { PdfPrintSettings } from '@/services/pdf/schema';

// Shared application defaults. Report-specific settings live beside each report.
export const dataApiCacheDefaults = {
  ttlMs: 30000,
  maxEntries: 500,
  maxBytes: 16 * 1024 * 1024,
};

export const queueDefaults = {
  concurrency: 2,
  presentationConcurrency: 4,
  maxPending: 200,
  waitTimeoutMs: 120000,
};

export const pdfPrintSettings: PdfPrintSettings = {
  format: PdfFormat.A4,
  landscape: false,
  margin: { top: 12, right: 12, bottom: 12, left: 12 },
  scale: 1,
  printBackground: true,
  printImages: true,
  media: PdfMedia.Print,
  preferCSSPageSize: false,
  displayHeaderFooter: false,
  // Chromium supports date, title, url, pageNumber and totalPages classes.
  headerTemplate: '<span></span>',
  footerTemplate: '<span></span>',
  hideSelectors: [] as string[],
  // Applied after the webapp styles; use @media print for print-only rules.
  css: '',
};
