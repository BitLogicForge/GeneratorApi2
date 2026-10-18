# Data API Client Service

[Back to Documentation Index](../README.md)

## Overview

`DataApiClient` (`src/services/data-api-client.ts`) fetches and validates JSON
from an upstream API using an endpoint registry (`src/data-api/endpoints.ts`)
and an optional in-memory LRU cache (`lru-cache`).

- `src/services/data-api/url.ts` (`buildDataApiUrl`): Ensures paths are
  relative, resolves them under `DATA_API_BASE_URL` (preserving base path
  prefixes), and validates finite query values.
- `src/services/data-api/request.ts` (`requestDataApi`): Applies a single
  `AbortSignal.timeout(timeoutMs)` across both HTTP response headers and JSON
  body reading, blocks redirects (`redirect: 'manual'`), and validates the
  payload with the endpoint's Zod response schema.

## Configuration & Caching

```dotenv
DATA_API_BASE_URL=http://localhost:3002/api
DATA_API_TOKEN=
DATA_API_TIMEOUT_MS=10000
DATA_API_CACHE_TTL_MS=30000
DATA_API_CACHE_MAX_ENTRIES=500
DATA_API_CACHE_MAX_BYTES=16777216
```

- Setting `DATA_API_CACHE_TTL_MS=0` disables caching.
- Cache keys combine `[endpointName, canonicalSortedUrl, sha256(token)]`.
- Concurrent misses for the same key share a single in-flight request, and
  callers receive a `structuredClone` copy so local mutations never corrupt
  cached entries.

## Usage & Runnable Examples

```ts
const data = await dataApi.get(
  'report',
  { id: 'id2222' },
  {
    language: 'en',
    year: 2026,
  },
);
```

Start the synthetic Data API in one terminal (`npm run demo:data-api`), then run
any of the example workflows in a second terminal:

- **Single request (`examples/data-api/single/fetch.ts`)**:
  `DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-data -- id2222 en 2026`
- **Chained requests (`examples/data-api/chain/collect.ts`)**:
  `DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-chain -- id2222 en 2026`
- **Batch collection (`examples/data-api/batch/collect.ts`)**:
  `DATA_API_BASE_URL=http://localhost:3002/api npm run example:fetch-batch -- dict en 2026`
- **Fetch Data API to PPTX (`examples/data-api/data-to-pptx.ts`)**:
  `DATA_API_BASE_URL=http://localhost:3002/api npm run example:data-to-pptx -- id2222 en 2026`
