import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chromium } from 'playwright';
import request from 'supertest';

import { createApp } from '@/app';
import { discoverRoutes } from '@/http/file-routes/discover';

import type { AddressInfo } from 'node:net';

function app() {
  return createApp({
    pdf: { generate: async () => Buffer.from('%PDF-test') },
    presentations: { generate: async () => Buffer.from('pptx') },
    logger: { error: () => {} },
  });
}

test('OpenAPI includes every discovered route and implicit HEAD, without invoking generation', async () => {
  const api = createApp({
    pdf: {
      generate: async () => {
        throw new Error('Must not render');
      },
    },
    presentations: {
      generate: async () => {
        throw new Error('Must not generate');
      },
    },
    logger: { error: () => {} },
  });
  const response = await request(api).get('/openapi.json').expect(200);
  assert.equal(response.body.openapi, '3.1.0');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.ok(response.headers['x-request-id']);
  const routes = await discoverRoutes(
    new URL('../../src/routes/', import.meta.url),
  );
  const ids: string[] = [];
  for (const route of routes) {
    const path = route.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}');
    assert.ok(
      response.body.paths[path][route.method],
      `${route.method} ${path}`,
    );
    if (route.method === 'get') {
      const head = response.body.paths[path].head;
      assert.ok(head);
      for (const value of Object.values(head.responses))
        assert.equal((value as { content?: unknown }).content, undefined);
    }
  }
  for (const item of Object.values(response.body.paths)) {
    for (const operation of Object.values(
      item as Record<string, { operationId: string }>,
    ))
      ids.push(operation.operationId);
  }
  assert.equal(new Set(ids).size, ids.length);
  await request(api).head('/openapi.json').expect(200);
});

test('OpenAPI describes actual GET JSON encoding, POST defaults, restrictions, and file responses', async () => {
  const { body } = await request(app()).get('/openapi.json').expect(200);
  const pdf = body.paths['/api/exports/pdf'];
  assert.deepEqual(
    pdf.post.requestBody.content['application/json'].schema.required,
    ['route'],
  );
  assert.equal(
    pdf.post.requestBody.content['application/json'].schema.properties.filename
      .default,
    'document',
  );
  const query = pdf.get.parameters.find(
    (parameter: { name: string }) => parameter.name === 'query',
  );
  assert.equal(query.schema, undefined);
  assert.equal(query.content['application/json'].schema.type, 'object');
  const landscape = pdf.get.parameters.find(
    (parameter: { name: string }) => parameter.name === 'landscape',
  );
  assert.equal(landscape.content['application/json'].schema.type, 'boolean');
  assert.ok(pdf.get.responses['200'].content['application/pdf']);
  assert.equal(
    pdf.get.responses['200'].headers['Cache-Control'].schema.const,
    'no-store',
  );
  assert.ok(pdf.get.responses['200'].headers['Content-Disposition']);
  assert.equal(
    pdf.post.responses['413'].content['application/json'].schema.$ref,
    '#/components/schemas/Error',
  );
  assert.equal(
    pdf.get.responses['503'].headers['Retry-After'].schema.const,
    '5',
  );
  assert.equal(body.paths['/{id}.pdf'].get.parameters[0].in, 'path');
  assert.equal(body.paths['/{id}.pdf'].get.parameters[0].required, true);
  const business = body.paths['/api/exports/pptx/jszip/business'];
  const replacements =
    business.post.requestBody.content['application/json'].schema.properties
      .replacements;
  assert.equal(replacements.minProperties, 1);
  assert.equal(replacements.maxProperties, 100);
  assert.ok(
    business.get.parameters.find(
      (parameter: { name: string }) => parameter.name === 'replacements',
    ).content['application/json'],
  );
  assert.ok(
    body.paths['/internal/ready'].get.responses['503'].content[
      'application/json'
    ].schema.properties.ready,
  );
  await request(app())
    .get('/api/exports/pdf')
    .query({
      route: '/reports/quarterly',
      query: JSON.stringify(query.content['application/json'].example),
    })
    .expect(200);
});

test('Swagger serves local assets and keeps the API security policy intact', async () => {
  const api = app();
  await request(api).get('/docs').expect(301);
  const html = await request(api).get('/docs/').expect(200);
  assert.match(html.text, /swagger-ui/);
  assert.match(html.headers['content-security-policy'], /script-src 'self'/);
  assert.doesNotMatch(
    html.headers['content-security-policy'],
    /upgrade-insecure-requests/,
  );
  await request(api).get('/docs/swagger-ui-bundle.js').expect(200);
  const init = await request(api).get('/docs/swagger-ui-init.js').expect(200);
  assert.match(init.text, /\/openapi\.json/);
  const health = await request(api).get('/health').expect(200);
  assert.match(
    health.headers['content-security-policy'],
    /upgrade-insecure-requests/,
  );
});

test('Swagger renders the specification in Chromium without CSP failures', async (t) => {
  const server = app().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  page.on('console', (message) => {
    if (/CSP violation:/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP violation: ${event.violatedDirective}`);
    });
  });
  await page.goto(`${base}/docs/`);
  await page
    .locator('.info .title')
    .filter({ hasText: 'Generator API' })
    .waitFor();
  assert.ok((await page.locator('.opblock').count()) > 0);
  const operation = page.locator('#operations-PDF-get__api_exports_pdf');
  await operation.locator('.opblock-summary').click();
  await operation.getByRole('button', { name: 'Try it out' }).click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/exports/pdf' &&
        response.request().method() === 'GET',
    ),
    operation.getByRole('button', { name: 'Execute', exact: true }).click(),
  ]);
  assert.equal(response.status(), 200);
  const query = new URL(response.url()).searchParams;
  assert.deepEqual(JSON.parse(query.get('query')!), { year: 2026, quarter: 3 });
  assert.equal(JSON.parse(query.get('landscape')!), false);
  assert.deepEqual(errors, []);
});
