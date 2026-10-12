# Fetching report data

[Back to overview](../README.md)

## Cached upstream values

Each `DataApiClient` instance caches successful Zod-validated responses using `lru-cache`. Reuse the client across requests to benefit from the cache. Defaults are a 30-second TTL, 500 entries, and a 16 MiB budget for serialized values and keys. Oversized values are returned without being retained. The budget does not represent total JavaScript heap usage or limit concurrent upstream requests.

```dotenv
DATA_API_CACHE_TTL_MS=30000
DATA_API_CACHE_MAX_ENTRIES=500
DATA_API_CACHE_MAX_BYTES=16777216
```

Default cache settings are defined once in `dataApiCacheDefaults` in `src/config/defaults.ts`; environment overrides and directly constructed clients use those same defaults.

Set `DATA_API_CACHE_TTL_MS=0` to disable caching. Values expire after the configured interval from insertion; reads do not extend it. Stale values are not served. Configure a shorter TTL or disable caching when fresh data is required. Restarting the process or creating a new client discards cached values.

Keys distinguish endpoints, full upstream URLs with sorted query parameters, and a hash of the bearer token. Keep endpoint definitions and schemas unchanged during a client's lifetime; create a new client when those contracts change. Simultaneous misses for the same key share one fetch and validation. Errors are not cached, and each caller receives a deep copy so mutations cannot affect later reads.

The cache is local to one client in one process; multiple API instances do not share it. This feature affects consumers of `DataApiClient`, currently the data API examples. Document routes still generate fresh attachments and retain `Cache-Control: no-store`.

## Fetch report data from another API

`DataApiClient` coordinates helpers in `src/services/data-api/`: `url.ts` validates paths and encodes queries; `request.ts` fetches JSON, applies the timeout, and validates responses.

The optional `DataApiClient` uses `config.dataApi` from `src/config.ts`:

```dotenv
DATA_API_BASE_URL=http://localhost:3002/api
DATA_API_TOKEN=
DATA_API_TIMEOUT_MS=10000
```

Set the base URL to your API, including its path prefix. A nonempty token is sent as a bearer token. The timeout covers fetching and reading the response. Leaving the base URL unset keeps this feature unconfigured without affecting document exports.

Run the local example in two terminals:

```bash
# Terminal 1: start the synthetic data API
npm run demo:data-api
```

```bash
# Terminal 2: fetch by document ID, language, and year
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-data -- id2222 en 2026
```

This calls `/api/reports/id2222?language=en&year=2026` and saves `output/data-api/id2222.json`. If the settings are already in `.env`, omit the inline environment variable. The example defaults to `id2222`, the configured language, and year 2026 when arguments are omitted.

Define upstream endpoints in `src/data-api/endpoints.ts`, exposed as `config.dataApi.endpoints`. Each definition pairs a path builder with a Zod response schema; the client infers the returned TypeScript type and validates the JSON automatically. Use the client in a service like this:

```ts
const api = new DataApiClient(config.dataApi);
const data = await api.get('report', { id }, { language: 'en', year: 2026 });
const customer = await api.get('customer', { id: 'customer100' });
const summary = await api.get(
  'reportSummary',
  { id },
  { language: 'en', year: 2026 },
);
```

The demo API also serves `GET /api/customers/:id` (customer name, industry, and contact email; no query parameters) and `GET /api/reports/:id/summary` (customer ID, revenue, and growth; optional `language` and `year`, defaulting to `en` and `2026`). Their response schemas live beside the endpoint registry in `src/data-api/`.

See `examples/data-api/single/fetch.ts` for imports and complete usage. Query values can be strings, numbers, booleans, or `undefined` (omitted); they are URL-encoded automatically. Adapt `src/data-api/report-data-schema.ts` to your API's response. The example returns three table rows, twenty chart rows, and category labels, ready for the existing template helpers. Current demo exports continue using random numbers; fetching is available as a separate example for the future integration.

For dependent requests, see [examples/data-api/chain/collect.ts](../examples/data-api/chain/collect.ts): fetch the summary, use its `customerId` to fetch the customer, then use its report ID, language, and year to fetch the full report. Each call is awaited and validated before proceeding. A failed request stops the chain and no combined file is written. With the demo API running, execute:

```bash
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-chain -- id2222 en 2026
```

The result is saved to `output/data-api/id2222-chain.json`, containing `summary`, `customer`, and `report`. The timeout applies separately to each request.

To fetch a list of IDs and collect their reports, use [examples/data-api/batch/collect.ts](../examples/data-api/batch/collect.ts):

```ts
const byId = await fetchReportDataBatch(
  api,
  { language: 'en', year: 2026 },
  'dict',
);
const report = byId['id2222'];
// Or collect a list of { requestedId, data } entries:
const entries = await fetchReportDataBatch(
  api,
  { language: 'en', year: 2026 },
  'list',
);
```

The configured `reportIds` endpoint calls `GET /api/reports`, returning `{ ids: ['id2222', 'id3333', 'id4444'] }` in the demo. Each distinct ID is requested sequentially, then all validated responses are collected. Dictionary keys use the requested ID, even if the response contains a different ID. Duplicate IDs are fetched once; an empty list returns an empty collection. A failed request or invalid response rejects the batch and no output file is written. With the demo API running:

```bash
DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-batch -- dict en 2026
# Replace dict with list for an array.
```

Output is saved to `output/data-api/reports-dict.json` or `reports-list.json`.

The client preserves the configured URL prefix, rejects paths outside it, and does not follow redirects. HTTP failures, connection failures, invalid JSON, and invalid response data become 502 errors; timeouts become 504 errors.

When the API is on your computer and Generator API runs in Docker, use a Docker-reachable hostname such as `host.docker.internal`, as described in [Docker setup](getting-started.md#access-from-outside-docker).

Generation services live in `src/services/pptxgenjs/` and `src/services/jszip/`. Designs and XML helpers live in `src/pptx/`; `placeholders.ts` handles text tokens independently of template registration and file loading.
