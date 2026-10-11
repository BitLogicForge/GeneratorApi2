import { createHash } from 'node:crypto';

import { LRUCache } from 'lru-cache';

import { dataApiCacheDefaults } from '@/config';
import { AppError } from '@/errors';

import { requestDataApi } from './data-api/request.ts';
import { buildDataApiUrl } from './data-api/url.ts';

import type { z } from 'zod';
import type { Config } from '@/config';

export type DataApiQuery = Record<
  string,
  string | number | boolean | undefined
>;

type EndpointRegistry = Record<
  string,
  {
    path: (params: never) => string;
    response: z.ZodType;
  }
>;

type ClientConfig<Endpoints> = Omit<
  Config['dataApi'],
  'endpoints' | 'cache'
> & {
  endpoints: Endpoints;
  cache?: Config['dataApi']['cache'];
};

/** Fetches validated JSON from the configured API, preserving its base path. */
export class DataApiClient<Endpoints extends EndpointRegistry> {
  private readonly cache:
    | LRUCache<string, { data: unknown }, { load: () => Promise<unknown> }>
    | undefined;

  constructor(private readonly config: ClientConfig<Endpoints>) {
    const { ttlMs, maxEntries, maxBytes } =
      config.cache ?? dataApiCacheDefaults;
    if (ttlMs > 0) {
      this.cache = new LRUCache({
        max: maxEntries,
        maxSize: maxBytes,
        ttl: ttlMs,
        // Eviction must not cancel an upstream request already serving a caller.
        ignoreFetchAbort: true,
        sizeCalculation: (value, key) =>
          Buffer.byteLength(JSON.stringify(value.data)) +
          Buffer.byteLength(key),
        fetchMethod: async (_key, _stale, { context }) => ({
          data: await context.load(),
        }),
      });
    }
  }

  /** Keeps requests within the configured API prefix and validates responses under one fetch/read timeout. */
  async get<Key extends keyof Endpoints>(
    endpoint: Key,
    params: Parameters<Endpoints[Key]['path']>[0],
    query: DataApiQuery = {},
  ): Promise<z.output<Endpoints[Key]['response']>> {
    if (!this.config.baseUrl)
      throw new AppError(
        503,
        'DATA_API_NOT_CONFIGURED',
        'Configure DATA_API_BASE_URL before fetching report data',
      );
    const definition = this.config.endpoints[endpoint];
    if (!definition)
      throw new AppError(
        400,
        'UNKNOWN_DATA_API_ENDPOINT',
        'Data API endpoint not configured',
      );
    const url = buildDataApiUrl(
      this.config.baseUrl,
      definition.path(params as never),
      query,
    );
    const load = () =>
      requestDataApi(
        url,
        this.config,
        definition.response as z.ZodType<z.output<Endpoints[Key]['response']>>,
      );
    if (!this.cache) return load();
    const canonicalUrl = new URL(url);
    canonicalUrl.searchParams.sort();
    const scope = createHash('sha256')
      .update(this.config.token ?? '')
      .digest('hex');
    const key = JSON.stringify([endpoint, canonicalUrl.href, scope]);
    const value = await this.cache.fetch(key, { context: { load } });
    return structuredClone(value!.data) as z.output<Endpoints[Key]['response']>;
  }
}
