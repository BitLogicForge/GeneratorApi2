import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import {
  GenerationQueue,
  createGenerationQueues,
} from '@/queue/generation-queue';
import { createApp } from '@/app';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
const options = { concurrency: 2, maxPending: 200, waitTimeoutMs: 10000 };

test('200-job burst respects concurrency and FIFO order', async () => {
  const queue = new GenerationQueue(options);
  let running = 0,
    peak = 0;
  const started: number[] = [];
  const jobs = Array.from({ length: 200 }, (_, i) =>
    queue.run(async () => {
      running++;
      peak = Math.max(peak, running);
      started.push(i);
      await delay(1);
      running--;
      return i;
    }),
  );
  assert.equal(queue.stats.active, 2);
  assert.equal(queue.stats.pending, 198);
  const results = await Promise.all(jobs);
  await delay(0);
  assert.equal(peak, 2);
  assert.deepEqual(
    started,
    Array.from({ length: 200 }, (_, i) => i),
  );
  assert.deepEqual(results, started);
  assert.equal(queue.stats.active, 0);
  assert.equal(queue.stats.pending, 0);
});

test('full queue rejects excess work and failures release slots', async () => {
  const gate = deferred();
  const queue = new GenerationQueue({
    ...options,
    concurrency: 1,
    maxPending: 1,
  });
  const first = queue.run(() => gate.promise);
  const second = queue.run(async () => {
    throw new Error('generation failed');
  });
  const failure = assert.rejects(second, /generation failed/);
  await assert.rejects(
    queue.run(async () => {}),
    { code: 'QUEUE_FULL' },
  );
  gate.resolve();
  await first;
  await failure;
  await delay(0);
  assert.equal(await queue.run(async () => 'recovered'), 'recovered');
});

test('wait timeout and cancellation remove pending work without executing it', async () => {
  const queue = new GenerationQueue({
    ...options,
    concurrency: 1,
    waitTimeoutMs: 20,
  });
  const gate = deferred();
  const active = queue.run(() => gate.promise);
  let executed = false;
  await assert.rejects(
    queue.run(async () => {
      executed = true;
    }),
    { code: 'QUEUE_WAIT_TIMEOUT' },
  );
  const controller = new AbortController();
  const pending = queue.run(async () => {
    executed = true;
  }, controller.signal);
  const cancelled = assert.rejects(pending, { code: 'REQUEST_CANCELLED' });
  controller.abort();
  await cancelled;
  assert.equal(queue.stats.pending, 0);
  gate.resolve();
  await active;
  assert.equal(executed, false);
});

test('shutdown rejects pending and new jobs while active work finishes', async () => {
  const queue = new GenerationQueue({ ...options, concurrency: 1 });
  const gate = deferred();
  const active = queue.run(() => gate.promise);
  const waiting = assert.rejects(
    queue.run(async () => {}),
    { code: 'QUEUE_CLOSED' },
  );
  queue.close();
  await waiting;
  await assert.rejects(
    queue.run(async () => {}),
    { code: 'QUEUE_CLOSED' },
  );
  gate.resolve();
  await active;
  await delay(0);
  assert.equal(queue.stats.active, 0);
});

test('both API endpoints queue simultaneous requests and return downloads', async () => {
  const queues = createGenerationQueues({
    pdfConcurrency: 2,
    presentationConcurrency: 2,
  });
  const counts = { pdf: 0, presentations: 0 };
  const peaks = { pdf: 0, presentations: 0 };
  const generate = (kind: keyof typeof counts) => async () => {
    counts[kind]++;
    peaks[kind] = Math.max(peaks[kind], counts[kind]);
    await delay(10);
    counts[kind]--;
    return Buffer.from(kind === 'pdf' ? '%PDF-1.7' : 'test-pptx');
  };
  const app = createApp({
    queues,
    pdf: { generate: generate('pdf') },
    presentations: { generate: generate('presentations') },
  });
  const responses = await Promise.all(
    Array.from({ length: 20 }, () => [
      request(app).post('/api/exports/pdf').send({ route: '/report' }),
      request(app)
        .post('/api/exports/pptx/generated/brief')
        .send({
          title: 'Report',
          slides: [{ title: 'Summary', bullets: ['Done'] }],
        }),
    ]).flat(),
  );
  assert.ok(responses.every((res) => res.status === 200));
  assert.deepEqual(peaks, { pdf: 2, presentations: 2 });
});

test('queue backpressure returns a retryable API error', async () => {
  const queues = createGenerationQueues();
  queues.pdf.close();
  const app = createApp({
    queues,
    pdf: { generate: async () => Buffer.alloc(0) },
    presentations: { generate: async () => Buffer.alloc(0) },
    logger: { error() {} },
  });
  const res = await request(app)
    .post('/api/exports/pdf')
    .send({ route: '/report' })
    .expect(503);
  assert.equal(res.body.error.code, 'QUEUE_CLOSED');
  assert.equal(res.headers['retry-after'], '5');
});
