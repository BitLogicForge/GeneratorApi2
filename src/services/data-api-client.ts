import type { z } from 'zod';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';
import { buildDataApiUrl } from './data-api/url.js';
import { requestDataApi } from './data-api/request.js';

export type DataApiQuery = Record<
  string,
  string | number | boolean | undefined
>;

/** Fetches validated JSON from the configured API, preserving its base path. */
export class DataApiClient {
  constructor(private readonly config: Config['dataApi']) {}

  /** Keeps requests within the configured API prefix and validates responses under one fetch/read timeout. */
  async get<T>(
    path: string,
    query: DataApiQuery,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (!this.config.baseUrl)
      throw new AppError(
        503,
        'DATA_API_NOT_CONFIGURED',
        'Configure DATA_API_BASE_URL before fetching report data',
      );
    const url = buildDataApiUrl(this.config.baseUrl, path, query);
    return requestDataApi(url, this.config, schema);
  }
}
