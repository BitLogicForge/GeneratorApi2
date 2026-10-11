# PDF generation

[Back to overview](../README.md)

## PDF endpoints

Document and report downloads live under `/api/exports/pdf`; the generic test
export lives at `/api/exports/pdf/test`:

| Endpoint                                  | Source                                                                       | Orientation                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| GET/POST `/api/exports/pdf/test`          | Explicit relative webapp `route`                                             | Request options, falling back to `pdfPrintSettings` |
| GET `/api/exports/pdf/portrait/:id.pdf`   | Document ID resolved through `documentSettings.pdfRoutePattern`              | Always portrait                                     |
| GET `/api/exports/pdf/portrait/quarterly` | Fixed `/reports/quarterly` page with direct year/quarter/language parameters | Always portrait                                     |
| GET `/api/exports/pdf/landscape/:id.pdf`  | Same document-ID source                                                      | Always landscape                                    |

GET endpoints also support HEAD metadata without rendering. The old root-level
`/:id.pdf` and `/landscape/:id.pdf` endpoints have been removed. The generic
GET/POST endpoint moved from `/api/exports/pdf` to `/api/exports/pdf/test`.
See [the PDF examples](../examples/pdf/README.md) for file roles, requests and
output filenames.

## Where PDF readiness is configured

Every PDF render waits for the page `load` event and fonts. Waiting for a
visible readiness element happens only when `PdfInput.waitForSelector` is set.
There is no global `waitForSelector` setting.

| Endpoint                              | Where the selector comes from                                                                                                    | Current behavior                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| GET/POST `/api/exports/pdf/test`      | Caller supplies `waitForSelector` in the GET query or POST JSON; `src/routes/api/exports/pdf/schema.ts` validates it as optional | Waits for the supplied selector, or just page load and fonts when omitted |
| `/api/exports/pdf/portrait/:id.pdf`   | Renderer input assembled in `src/routes/api/exports/pdf/portrait/[id].pdf/document-pdf.ts`                                       | No selector is set; waits for page load and fonts                         |
| `/api/exports/pdf/landscape/:id.pdf`  | Renderer input assembled in `src/routes/api/exports/pdf/landscape/[id].pdf/document-pdf.ts`                                      | No selector is set; waits for page load and fonts                         |
| `/api/exports/pdf/portrait/quarterly` | `src/routes/api/exports/pdf/portrait/quarterly/quarterly-report-pdf.ts`                                                          | Always waits for visible `[data-report-ready]`                            |

The quarterly query schema validates year, quarter and language; the selector
is set by its input resolver, not by the schema. For document-ID routes, add
`waitForSelector: '[data-report-ready]'` to the `pdfSchema.parse({...})` object
in the chosen document route's `document-pdf.ts` to make that orientation wait for the marker.
Set it in both files if both orientations should wait. These routes reject
`waitForSelector` in the URL; readiness is configured only in their input files.

If a configured marker never becomes visible, the render times out with
`504 RENDER_TIMEOUT`. HEAD returns metadata without loading the webapp or waiting.

## PDF download URLs

Query parameters are optional. `/api/exports/pdf/portrait/id2222.pdf` uses `documentSettings.defaultLanguage` (`en` by default), configured in `src/config.ts`; `/api/exports/pdf/portrait/id2222.pdf?language=de` overrides it. A language already set in `documentSettings.pdfRoutePattern` stays authoritative. Other omitted query parameters use your webapp's defaults.

`GET /api/exports/pdf/portrait/:id.pdf` provides a direct download link such as `https://generator-host/api/exports/pdf/portrait/id2222.pdf`. Configure the webapp host in Azure application settings (or `.env` locally) and the document route in `src/config.ts`:

```dotenv
WEBAPP_BASE_URL=https://other-host.example
```

In `src/config.ts`:

```ts
const documentSettings = {
  defaultLanguage: 'en',
  pdfRoutePattern: '/document?id={id}',
};
```

With these settings, `https://generator-host/api/exports/pdf/portrait/id2222.pdf?language=en` renders `https://other-host.example/document?id=id2222&language=en` and returns an `id2222.pdf` attachment. For path-based webapps, use `pdfRoutePattern: '/documents/{id}'` in `src/config.ts` (the default). Only `language` (nonempty text, up to 100 characters) and `year` (four digits, 2000–2100) are accepted and forwarded as strings. Unknown parameters return 400. Query keys already configured in the pattern cannot be overridden by the caller. Duplicate query keys are rejected. IDs accept up to 80 letters, numbers, underscores, and hyphens.

The GET endpoint uses the same PDF queue and rendering settings as `POST /api/exports/pdf/test`. It does not cache documents or forward client cookies. The POST endpoint remains available for per-request readiness selectors and print options. For the included demo, start both servers and open `http://localhost:3000/api/exports/pdf/portrait/id2222.pdf`.

Every navigation, including HTTP redirect hops and frame navigations, must stay on the configured webapp origin. Same-origin redirects retain their final URL and relative asset resolution. Popups are blocked. A blocked navigation fails the export with 502 `NAVIGATION_BLOCKED` before the disallowed destination is requested. External assets and data requests remain permitted; this is a document-navigation boundary, not an egress firewall.
