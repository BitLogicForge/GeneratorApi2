import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDateTime } from '@/date-time';
import { filenameSchema } from '@/validation/filename';

test('date/time formatting uses UTC and zero-padded dates and minutes', () => {
  const date = new Date('2024-03-01T01:05:59+02:00');
  assert.equal(formatDateTime(date, { format: 'date' }), '2024-02-29');
  assert.equal(formatDateTime(date, { format: 'time' }), '23:05');
  assert.equal(formatDateTime(date), '2024-02-29 23:05');
  assert.equal(date.toISOString(), '2024-02-29T23:05:59.000Z');
});

test('each filename-safe format is accepted by the download filename validator', () => {
  const date = new Date('2024-02-29T03:04:00Z');
  for (const [format, expected] of [
    ['date', '2024-02-29'],
    ['time', '03-04'],
    ['datetime', '2024-02-29-03-04'],
  ] as const) {
    const value = formatDateTime(date, { format, filenameSafe: true });
    assert.equal(value, expected);
    assert.equal(filenameSchema.parse(value), expected);
  }
});
