import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AppError } from '@/errors';
import { mapPdfRoute } from '@/reports/pdf-route';

test('mapping renames supported parameters, omits absent and unmapped values, and preserves scalar values', () => {
  assert.deepEqual(
    mapPdfRoute(
      '/document?id=abc',
      {
        START: '2027-01-01',
        END: undefined,
        count: 0,
        enabled: false,
        ignored: 'private',
      },
      { START: 'from', END: 'to', count: 'limit', enabled: 'print' },
    ),
    {
      route: '/document?id=abc',
      query: { from: '2027-01-01', limit: 0, print: false },
    },
  );
});

test('mapped names cannot override fixed external query parameters', () => {
  assert.throws(
    () =>
      mapPdfRoute(
        '/document?from=fixed',
        { START: '2027-01-01' },
        { START: 'from' },
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.status === 400 &&
      error.code === 'RESERVED_QUERY_PARAMETER',
  );
});

test('defaults only fill missing values and never override fixed external query parameters', () => {
  assert.deepEqual(
    mapPdfRoute(
      '/document?language=pl',
      { year: '2027', language: undefined },
      { year: 'year', language: 'language' },
      { language: 'en', year: '2026', print: true },
    ),
    {
      route: '/document?language=pl',
      query: { year: '2027', print: true },
    },
  );
  assert.deepEqual(
    mapPdfRoute(
      '/document',
      { language: undefined },
      { language: 'language' },
      { language: 'en' },
    ).query,
    { language: 'en' },
  );
});
