import type { Request } from 'express';

export function generationInput(req: Request) {
  if (req.method !== 'GET') return req.body;
  return Object.fromEntries(
    Object.entries(req.query).map(([key, value]) => [
      key,
      ['query', 'slides', 'replacements', 'landscape'].includes(key)
        ? JSON.parse(value as string)
        : value,
    ]),
  );
}
