import type { z } from 'zod';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';
import { buildDataApiUrl } from './data-api/url.js';
import { requestDataApi } from './data-api/request.js';

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

type ClientConfig<Endpoints> = Omit<Config['dataApi'], 'endpoints'> & {
  endpoints: Endpoints;
};

/** Fetches validated JSON from the configured API, preserving its base path. */
export class DataApiClient<Endpoints extends EndpointRegistry> {
  constructor(private readonly config: ClientConfig<Endpoints>) {}

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
    return requestDataApi(
      url,
      this.config,
      definition.response as z.ZodType<z.output<Endpoints[Key]['response']>>,
    );
  }
}
