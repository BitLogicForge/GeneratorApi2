import type { Config } from '../config.js';

export type DataApiQuery = Record<
  string,
  string | number | boolean | undefined
>;

export class DataApiClient {
  constructor(private readonly config: Config['dataApi']) {}

  async get<T>(path: string, query: DataApiQuery = {}): Promise<T> {
    const base = new URL(this.config.baseUrl);
    base.pathname = `${base.pathname.replace(/\/$/, '')}/`;
    const url = new URL(path.replace(/^\//, ''), base);
    for (const [key, value] of Object.entries(query))
      if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(this.config.token
          ? { Authorization: `Bearer ${this.config.token}` }
          : {}),
      },
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    return response.json() as Promise<T>;
  }
}
