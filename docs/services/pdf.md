# PDF Rendering Service

[Back to Documentation Index](../README.md)

## Overview

PDF generation is handled by `WebPagePdfService`
(`src/services/pdf/web-page-pdf.ts`), which manages the shared headless Chromium
browser and concurrency slots, and `renderPagePdf`
(`src/services/pdf/render-page.ts`), which navigates an isolated page, applies
print styles, and prints to PDF.

## Origin & Navigation Boundary

- By default, routes resolve against `WEBAPP_BASE_URL`. A report definition can
  specify a trusted server-owned `externalOrigin` (validated by
  `pdfOriginSchema`), as in `src/routes/pdf/example/report.ts`.
- `navigationBoundary` (`src/services/pdf/navigation-boundary.ts`) attaches both:
  1. A Playwright context route (`context.route('**/*', ...)`) to block popups
     and cross-origin frame navigations.
  2. A page CDP session (`Fetch.requestPaused` on `Document` requests) to block
     cross-origin server redirect hops before the destination is requested.
- Any disallowed navigation immediately aborts the render with
  `502 NAVIGATION_BLOCKED`. Subresource requests (images, fonts, XHR/fetch)
  remain permitted.

## Readiness & Print Settings

Every render performs the following sequence under `RENDER_TIMEOUT_MS` (default
`30000` ms):

1. `page.goto(url.href, { waitUntil: 'load' })` (non-2xx responses fail with
   `502 UPSTREAM_ERROR`).
2. Optional `waitForSelector` (`state: 'visible'`).
3. Optional `waitForNetworkIdle` (`page.waitForLoadState('networkidle')`).
4. `page.emulateMedia({ media: settings.media })` (`'print'` by default).
5. Injects CSS overrides (`settings.css`, image hiding when
   `printImages: false`, and `display: none !important` for `hideSelectors`).
6. Waits for `document.fonts.ready`, then calls `page.pdf(...)`.

Shared print defaults live in `pdfPrintSettings` (`src/config/defaults.ts`) and
are merged with report-level `print` overrides via `resolvePdfPrintSettings`
(`src/services/pdf/schema.ts`).

## Standalone CLI Example

```bash
# Start demo webapp on port 3001
npm run demo

# Render PDF directly without the Express server
npm run example:render-pdf -- examples/pdf/quarterly-portrait.json
npm run example:render-pdf -- examples/pdf/quarterly-landscape.json
```
