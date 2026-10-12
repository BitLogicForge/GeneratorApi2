# PDF generation

[Back to overview](../README.md)

## PDF endpoints

| Endpoint                                       | External webapp page      | Orientation                         |
| ---------------------------------------------- | ------------------------- | ----------------------------------- |
| GET/POST `/api/exports/pdf/test`               | Explicit relative `route` | Request options and shared defaults |
| GET/HEAD `/api/exports/pdf/factsheet/:id`      | `/factsheet/{id}`         | Always portrait                     |
| GET/HEAD `/api/exports/pdf/onepager/:id`       | `/onepager/{id}`          | Always landscape                    |
| GET/HEAD `/api/exports/pdf/portrait/quarterly` | `/reports/quarterly`      | Always portrait                     |

Factsheet and onepager URLs use the bare ID, without a `.pdf` suffix. Both download an attachment named `{id}.pdf`. The previous portrait/landscape document download URLs are removed. See [PDF examples](../examples/pdf/README.md).

## External page configuration

Configure the external origin with `WEBAPP_BASE_URL`. Set each document page independently in `src/reports/document/settings.ts`:

```ts
export const documentSettings = {
  defaultLanguage: 'en',
  routes: {
    factsheet: '/factsheet/{id}',
    onepager: '/onepager/{id}',
  },
};
```

For `WEBAPP_BASE_URL=https://other-host.example`:

| API request                                              | External request                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------ |
| `/api/exports/pdf/factsheet/id2222?language=de`          | `https://other-host.example/factsheet/id2222?language=de`          |
| `/api/exports/pdf/onepager/id2222?language=en&year=2027` | `https://other-host.example/onepager/id2222?language=en&year=2027` |

The demo webapp serves both pages. Custom patterns can put the ID in a query parameter, such as `factsheet: '/factsheet?id={id}'`; each pattern must be a relative route containing `{id}`. Rebuild after changing these settings. Configured query keys remain authoritative and cannot be overridden by callers.

IDs accept 1–80 letters, numbers, underscores, and hyphens. Only `language` (nonempty text up to 100 characters) and `year` (four digits, 2000–2100) are accepted. Unknown, invalid, or duplicate parameters return 400 before rendering. Omitted language uses the configured default unless the selected page pattern already fixes it. Other omitted parameters use the webapp's defaults.

## Readiness and appearance

Every render waits for page load and fonts. Factsheet and onepager have no additional readiness selector. The shared `src/reports/document/report.ts` owns their validation and target resolution. The quarterly report sets `[data-report-ready]` in its route-local `report.ts`; the generic test export can accept a caller-supplied `waitForSelector`.

A missing readiness marker produces `504 RENDER_TIMEOUT`. HEAD validates input and returns attachment metadata without loading the webapp or entering the render queue.

Shared appearance lives in `src/config/defaults.ts`. A `definePdfReport` definition can specify server-owned `print` overrides, including individual margin sides. Factsheet always selects portrait and onepager always selects landscape. The generic test export accepts its declared per-request print options. See [adding a PDF endpoint](development.md#add-a-pdf-endpoint).

## Navigation and downloads

Both document routes use the shared PDF queue and renderer, return `application/pdf` attachments with `Cache-Control: no-store`, and include a request ID. They do not cache files or forward caller cookies/credentials.

Every document navigation, including redirect hops and frame navigations, must stay on the configured origin. Same-origin redirects retain their final URL and relative asset resolution. Popups are blocked. A disallowed navigation fails with `502 NAVIGATION_BLOCKED` before that destination is requested. External assets and data requests remain permitted.
