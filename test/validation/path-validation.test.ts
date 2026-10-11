import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pdfRoutePatternSchema } from '@/pdf-route';
import { pdfSchema } from '@/schemas';
import { buildDataApiUrl } from '@/services/data-api/url';

test('PDF routes, route patterns, and data API paths reject every ASCII control character', () => {
  for (let code = 0; code <= 0x1f; code++) {
    const character = String.fromCharCode(code);
    for (const suffix of [
      `${character}report`,
      `re${character}port`,
      `report${character}`,
    ]) {
      const path = `/reports/${suffix}`;
      assert.equal(
        pdfSchema.safeParse({ route: path }).success,
        false,
        `PDF: ${code}`,
      );
      assert.equal(
        pdfRoutePatternSchema.safeParse(`${path}/{id}`).success,
        false,
        `pattern: ${code}`,
      );
      assert.throws(
        () => buildDataApiUrl('https://example.com/api', path, {}),
        { code: 'INVALID_DATA_API_PATH' },
      );
    }
  }
});

test('path validation preserves accepted printable and Unicode characters', () => {
  for (const suffix of [
    'normal',
    'with space',
    'Żółć',
    '😀',
    String.fromCharCode(0x7f),
  ]) {
    const path = `/reports/${suffix}`;
    assert.equal(pdfSchema.safeParse({ route: path }).success, true);
    assert.equal(pdfRoutePatternSchema.safeParse(`${path}/{id}`).success, true);
    assert.equal(
      buildDataApiUrl('https://example.com/api', path, {}).origin,
      'https://example.com',
    );
  }
});

test('route patterns still reject fragments and data API paths still reject query, fragment, and backslash', () => {
  assert.equal(
    pdfRoutePatternSchema.safeParse('/reports/{id}#fragment').success,
    false,
  );
  for (const path of [
    '/reports?year=2026',
    '/reports#fragment',
    '/reports' + String.fromCharCode(0x5c) + 'id',
  ]) {
    assert.throws(() => buildDataApiUrl('https://example.com/api', path, {}), {
      code: 'INVALID_DATA_API_PATH',
    });
  }
});
