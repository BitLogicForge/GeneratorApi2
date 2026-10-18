import { compile } from 'path-to-regexp';

type UrlValue = string | number | boolean;

/** Builds an absolute URL, encoding named placeholders and optional query values. */
export function buildUrl(
  baseUrl: string,
  route: string,
  options: {
    params?: Record<string, string>;
    query?: Record<string, UrlValue | undefined>;
  } = {},
): URL {
  const url = new URL(route, baseUrl);
  if (options.params !== undefined) url.pathname = compile(url.pathname)(options.params);
  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url;
}

/** Renames validated query fields, forwarding only mapped, defined values. */
export function mapQuery<Value extends UrlValue>(
  query: Record<string, Value | undefined>,
  names: Record<string, string>,
): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(names).flatMap(([name, externalName]) => {
      const value = query[name];
      return value === undefined ? [] : [[externalName, value]];
    }),
  );
}
