import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { z } from 'zod';

import { loadConfig } from '@/config';
import { DataApiClient } from '@/services/data-api-client';

const schema = z.object({ nested: z.object({ value: z.number() }) });
function configuration(
  cache = { ttlMs: 30000, maxEntries: 500, maxBytes: 16777216 },
) {
  return {
    ...loadConfig({ DATA_API_BASE_URL: 'https://data.example/api' }).dataApi,
    cache,
    endpoints: {
      first: {
        path: ({ id }: { id: string }) => `/reports/${id}`,
        response: schema,
      },
      second: {
        path: ({ id }: { id: string }) => `/reports/${id}`,
        response: schema,
      },
    },
  };
}

test('cache shares concurrent fetches, canonicalizes queries, and isolates returned values', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return Response.json({ nested: { value: calls } });
  });
  const api = new DataApiClient(configuration());
  const [first, second] = await Promise.all([
    api.get('first', { id: '1' }, { year: 2026, language: 'en' }),
    api.get(
      'first',
      { id: '1' },
      { language: 'en', year: 2026, omitted: undefined },
    ),
  ]);
  assert.equal(calls, 1);
  first.nested.value = 99;
  assert.equal(second.nested.value, 1);
  assert.equal(
    (await api.get('first', { id: '1' }, { year: 2026, language: 'en' })).nested
      .value,
    1,
  );
  await api.get('first', { id: '1' }, { year: 2027, language: 'en' });
  await api.get('first', { id: '2' }, { year: 2026, language: 'en' });
  await api.get('second', { id: '1' }, { year: 2026, language: 'en' });
  assert.equal(calls, 4);
});

test('cache separates clients and authorization scopes', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ nested: { value: ++calls } }),
  );
  const config = configuration();
  config.token = 'first-token';
  const api = new DataApiClient(config);
  assert.equal((await api.get('first', { id: '1' })).nested.value, 1);
  config.token = 'second-token';
  assert.equal((await api.get('first', { id: '1' })).nested.value, 2);
  const other = new DataApiClient(config);
  assert.equal((await other.get('first', { id: '1' })).nested.value, 3);
});

test('expired values are fetched again and zero TTL disables the cache', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ nested: { value: ++calls } }),
  );
  const api = new DataApiClient(
    configuration({ ttlMs: 20, maxEntries: 10, maxBytes: 10000 }),
  );
  await api.get('first', { id: '1' });
  await delay(50);
  assert.equal((await api.get('first', { id: '1' })).nested.value, 2);
  const uncached = new DataApiClient(
    configuration({ ttlMs: 0, maxEntries: 10, maxBytes: 10000 }),
  );
  await uncached.get('first', { id: '1' });
  await uncached.get('first', { id: '1' });
  assert.equal(calls, 4);
});

test('entry and byte limits evict values; oversized values are still returned', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ nested: { value: ++calls } }),
  );
  const api = new DataApiClient(
    configuration({ ttlMs: 30000, maxEntries: 1, maxBytes: 10000 }),
  );
  await api.get('first', { id: '1' });
  await api.get('first', { id: '2' });
  assert.equal((await api.get('first', { id: '1' })).nested.value, 3);
  // Enough for one key/value, but not two.
  const bounded = new DataApiClient(
    configuration({ ttlMs: 30000, maxEntries: 10, maxBytes: 200 }),
  );
  await bounded.get('first', { id: '1' });
  await bounded.get('first', { id: '2' });
  assert.equal((await bounded.get('first', { id: '1' })).nested.value, 6);
  const tiny = new DataApiClient(
    configuration({ ttlMs: 30000, maxEntries: 10, maxBytes: 1 }),
  );
  assert.equal((await tiny.get('first', { id: '1' })).nested.value, 7);
  assert.equal((await tiny.get('first', { id: '1' })).nested.value, 8);
});

test('HTTP, JSON, schema, and network failures are retried instead of cached', async (t) => {
  for (const fail of [
    () => new Response('unavailable', { status: 503 }),
    () => new Response('not JSON'),
    () => Response.json({ nested: { value: 'invalid' } }),
    () => {
      throw new Error('network failure');
    },
  ]) {
    let calls = 0;
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return calls === 1 ? fail() : Response.json({ nested: { value: 42 } });
    });
    const api = new DataApiClient(configuration());
    await assert.rejects(api.get('first', { id: '1' }));
    assert.equal((await api.get('first', { id: '1' })).nested.value, 42);
    await api.get('first', { id: '1' });
    assert.equal(calls, 2);
    mock.mock.restore();
  }
});

test('cache environment configuration rejects invalid limits', () => {
  assert.deepEqual(loadConfig({}).dataApi.cache, {
    ttlMs: 30000,
    maxEntries: 500,
    maxBytes: 16777216,
  });
  for (const env of [
    { DATA_API_CACHE_TTL_MS: '-1' },
    { DATA_API_CACHE_MAX_ENTRIES: '0' },
    { DATA_API_CACHE_MAX_BYTES: '0' },
  ])
    assert.throws(() => loadConfig(env));
});

test('evicting an in-flight entry does not fail its waiting caller', async (t) => {
  const releases: (() => void)[] = [];
  t.mock.method(globalThis, 'fetch', async () => {
    await new Promise<void>((resolve) => releases.push(resolve));
    return Response.json({ nested: { value: 42 } });
  });
  const api = new DataApiClient(
    configuration({ ttlMs: 30000, maxEntries: 1, maxBytes: 10000 }),
  );
  const pending = Promise.all([
    api.get('first', { id: '1' }),
    api.get('first', { id: '2' }),
  ]);
  for (const release of releases) release();
  const values = await pending;
  assert.deepEqual(values, [
    { nested: { value: 42 } },
    { nested: { value: 42 } },
  ]);
});
