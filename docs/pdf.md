# PDF generation

[Back to overview](../README.md)

## PDF endpoints

| Endpoint                      | External webapp page      | Orientation                         |
| ----------------------------- | ------------------------- | ----------------------------------- |
| GET/POST `/pdf/test`          | Explicit relative `route` | Request options and shared defaults |
| GET/HEAD `/pdf/factsheet/:id` | `/factsheet/{id}`         | Always portrait                     |
| GET/HEAD `/pdf/onepager/:id`  | `/onepager/{id}`          | Always landscape                    |
| GET/HEAD `/pdf/quarterly`     | `/reports/quarterly`      | Always portrait                     |

Factsheet and onepager URLs use the bare ID, without a `.pdf` suffix. Both download an attachment named `{id}.pdf`. The previous portrait/landscape document download URLs are removed. See [PDF examples](../examples/pdf/README.md).

## External page configuration

Configure the external origin with `WEBAPP_BASE_URL`. Each endpoint folder owns
its `schema.ts` (path and query validation), `report.ts` (external URL, parameter
mapping, default language, filename, and print settings), and `get.ts` (registration).
For example, edit `src/routes/pdf/onepager/[id]/report.ts` to change
`externalRoute` or the mapping passed to `mapPdfRoute`. Mapping keys are public
input names and values are external query names; absent values are omitted. The
shared helper lives in `src/reports/pdf-route.ts` and also handles fixed-query
conflicts and optional defaults.
The factsheet folder has its own independent definition.

For `WEBAPP_BASE_URL=https://other-host.example`:

| API request                                                 | External request                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/pdf/factsheet/id2222?language=de`                         | `https://other-host.example/factsheet/id2222?language=de`                         |
| `/pdf/onepager/id2222?START=2027-01-01&BENCHMARK=REPORTING` | `https://other-host.example/onepager/id2222?START=2027-01-01&BENCHMARK=REPORTING` |

The demo webapp serves both pages. Custom patterns can put the ID in a query parameter, such as `/factsheet?id={id}`; each pattern must be a relative route containing `{id}`. Rebuild after changing these settings. Configured query keys remain authoritative and cannot be overridden by callers.

IDs accept 1–80 letters, numbers, underscores, and hyphens. Factsheet accepts `language` (nonempty text up to 100 characters) and `year` (four digits, 2000–2100). Onepager instead accepts optional `START` and `END` (valid `YYYY-MM-DD` dates), and `BENCHMARK` (`SAA` or `REPORTING`); it rejects `language` and `year`. These onepager parameters are forwarded using their uppercase names. Unknown, invalid, or duplicate parameters return 400 before rendering. On factsheet, omitted language uses the configured default unless the selected page pattern already fixes it. Other omitted parameters use the webapp's defaults.

## Readiness and appearance

Every render waits for page load and fonts. Factsheet and onepager have no additional readiness selector. Their route-local `schema.ts` and `report.ts` own validation and target resolution. The quarterly report sets `[data-report-ready]` in its route-local `report.ts`; the generic test export can accept a caller-supplied `waitForSelector`.

A missing readiness marker produces `504 RENDER_TIMEOUT`. HEAD validates input and returns attachment metadata without loading the webapp or entering the render queue.

Shared appearance lives in `src/config/defaults.ts`. A `definePdfReport` definition can specify server-owned `print` overrides, including individual margin sides. Factsheet always selects portrait and onepager always selects landscape. The generic test export accepts its declared per-request print options. See [adding a PDF endpoint](development.md#add-a-pdf-endpoint).

## Navigation and downloads

Both document routes use the shared PDF queue and renderer, return `application/pdf` attachments with `Cache-Control: no-store`, and include a request ID. They do not cache files or forward caller cookies/credentials.

Every document navigation, including redirect hops and frame navigations, must stay on the configured origin. Same-origin redirects retain their final URL and relative asset resolution. Popups are blocked. A disallowed navigation fails with `502 NAVIGATION_BLOCKED` before that destination is requested. External assets and data requests remain permitted.

PDF report orientation is defined only in `print.landscape` on the report
definition. `prepareInput` returns the external route, query, filename, and
readiness options; it cannot return `landscape` or `print`. Both TypeScript and
runtime validation enforce this rule. Omitted orientation uses shared print defaults.
