# PDF generation

[Back to overview](../../README.md)

## PDF endpoints

| Endpoint                      | External webapp page      | Orientation                         |
| ----------------------------- | ------------------------- | ----------------------------------- |
| GET/POST `/pdf/test`          | Explicit relative `route` | Request options and shared defaults |
| GET/HEAD `/pdf/factsheet/:id` | `/factsheet/:id`          | Always portrait                     |
| GET/HEAD `/pdf/onepager/:id`  | `/onepager/:id`           | Always landscape                    |
| GET/HEAD `/pdf/quarterly`     | `/reports/quarterly`      | Always portrait                     |

Factsheet and onepager URLs use the bare ID, without a `.pdf` suffix. Factsheet downloads `{id}.pdf`. Onepager downloads `onepager-YYYY-MM-DD-HH-mm-{id}.pdf`, using the request's UTC date and time. If the complete filename would exceed 80 characters before the extension, it uses `{id}.pdf` to preserve the full ID. The previous portrait/landscape document download URLs are removed. See [PDF examples](../../examples/pdf/README.md).

## External page configuration

Configure the external origin with `WEBAPP_BASE_URL`. Each endpoint folder owns
its `schema.ts` (path and query validation) and `report.ts` (external page pattern,
parameters, filename, and print settings). `src/routes/router.ts` registers the
public Express paths.
For example, `src/routes/pdf/onepager/report.ts` returns `route: '/onepager/:id'`,
`params: { id }`, and its validated `query` directly. The renderer calls the shared
`buildUrl` helper in `src/url.ts` to encode placeholders and append query values
to the full URL. Routes without placeholders need no `params`.
Map external query names or apply defaults explicitly in the report's
`prepareInput`, forwarding only validated fields. Fixed server-owned values
belong in the query object rather than caller-controlled input.
The factsheet folder has its own independent definition.

For `WEBAPP_BASE_URL=https://other-host.example`:

| API request                                                 | External request                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/pdf/factsheet/id2222`                                     | `https://other-host.example/factsheet/id2222`                                     |
| `/pdf/onepager/id2222?START=2027-01-01&BENCHMARK=REPORTING` | `https://other-host.example/onepager/id2222?START=2027-01-01&BENCHMARK=REPORTING` |

The demo webapp serves both pages. For an ID in the query string, return `route: "/factsheet"` and `query: { id }`. Use `params` for `:id` placeholders in paths only. Rebuild after changing these settings. Query values come only from the report's validated fields; keep fixed server-owned query values explicit when adding mappings.

IDs accept 1–80 letters, numbers, underscores, and hyphens. Factsheet accepts no query fields. Onepager accepts optional `START` and `END` (valid `YYYY-MM-DD` dates), and `BENCHMARK` (`SAA` or `REPORTING`); it rejects `language` and `year`. These onepager parameters are forwarded using their uppercase names. Unknown, invalid, or duplicate parameters return 400 before rendering. Omitted query parameters use the webapp's defaults.

## Readiness and appearance

Every render waits for page load and fonts. Factsheet and onepager have no additional readiness selector. Their route-local `schema.ts` and `report.ts` own validation and target resolution. The quarterly report sets `[data-report-ready]` in its route-local `report.ts`; the generic test export can accept a caller-supplied `waitForSelector`.

To wait for network activity to settle as well, set `waitForNetworkIdle: true`
in the route's `prepareInput` result. It defaults to disabled and works alongside
`waitForSelector`: after the selector becomes visible, rendering waits for no
active network connections for at least 500 ms. Both waits share `RENDER_TIMEOUT_MS`.
Pages with continuing network activity can time out.

```ts
prepareInput: ({ query }) => ({
  route: '/reports/quarterly',
  query,
  filename: 'report',
  waitForSelector: '[data-report-ready]',
  waitForNetworkIdle: true,
}),
```

A missing readiness marker or network-idle timeout produces `504 RENDER_TIMEOUT`. HEAD validates input and returns attachment metadata without loading the webapp or entering the render queue.

Shared appearance lives in `src/config/defaults.ts`. A `definePdfReport` definition can specify server-owned `print` overrides, including individual margin sides. Factsheet always selects portrait and onepager always selects landscape. The generic test export accepts its declared per-request print options. See [adding a PDF endpoint](../guides/development.md#add-a-pdf-endpoint).

## Navigation and downloads

Both document routes use the shared PDF queue and renderer, return `application/pdf` attachments with `Cache-Control: no-store`, and include a request ID. They do not cache files or forward caller cookies/credentials.

Every document navigation, including redirect hops and frame navigations, must stay on the configured origin. Same-origin redirects retain their final URL and relative asset resolution. Popups are blocked. A disallowed navigation fails with `502 NAVIGATION_BLOCKED` before that destination is requested. External assets and data requests remain permitted.

PDF report orientation is defined only in `print.landscape` on the report
definition. `prepareInput` returns the external route, query, filename, and
readiness options; it cannot return `landscape` or `print`. Both TypeScript and
runtime validation enforce this rule. Omitted orientation uses shared print defaults.
