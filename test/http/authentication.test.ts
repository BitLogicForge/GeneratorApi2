import assert from 'node:assert/strict';
import { test } from 'node:test';

import request from 'supertest';

import { createApp } from '@/app';
import { loadAuthConfig } from '@/auth/config';
import { createEntraAuthentication } from '@/auth/entra';

import type { AuthenticatedUser, AuthenticationOptions } from '@/auth/types';
import type { GenerationContext } from '@/http/types';

const tenantId = '11111111-1111-4111-8111-111111111111';
const audience = '22222222-2222-4222-8222-222222222222';
const user: AuthenticatedUser = {
  tenantId,
  objectId: '33333333-3333-4333-8333-333333333333',
};

function fixture(authentication?: AuthenticationOptions) {
  const calls: { route: string; context?: GenerationContext }[] = [];
  const app = createApp({
    authentication,
    pdf: {
      generate: async (_input, context) => {
        calls.push({ route: 'pdf', context });
        return Buffer.from('%PDF-1.7');
      },
    },
    presentations: {
      generate: async () => {
        calls.push({ route: 'brief' });
        return Buffer.from('pptx');
      },
    },
    templatePresentations: {
      generate: async (template) => {
        calls.push({ route: template });
        return Buffer.from('pptx');
      },
    },
    templateReportDemo: {
      generate: async (_text, context) => {
        calls.push({ route: 'daa', context });
        return Buffer.from('pptx');
      },
    },
    logger: { error() {} },
  });
  return { app, calls };
}

test('exports require verified bearer identities while health stays public', async () => {
  const verified: string[] = [];
  const { app, calls } = fixture({
    tenantId,
    verifyAccessToken: async (token) => {
      verified.push(token);
      if (token === 'invalid')
        throw new Error('Verifier details must not leak');
      return token === 'foreign'
        ? { ...user, tenantId: audience }
        : token === 'no-user'
          ? { ...user, objectId: '' }
          : user;
    },
  });
  for (const token of [
    '',
    'Basic abc',
    'Bearer invalid',
    'Bearer foreign',
    'Bearer no-user',
    'Bearer token extra',
  ]) {
    const call = request(app)
      .post('/api/exports/pdf')
      .send({ route: '/report' });
    if (token) call.set('Authorization', token);
    const response = await call.expect(401);
    assert.equal(response.headers['www-authenticate'], 'Bearer');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(response.body.error, {
      code: 'UNAUTHENTICATED',
      message: 'A valid API access token is required',
      requestId: response.headers['x-request-id'],
    });
  }
  await request(app)
    .get('/id.pdf')
    .set('X-MS-CLIENT-PRINCIPAL', 'pretend-user')
    .expect(401);
  await request(app).head('/id.pdf').expect(401);
  await request(app).get('/health').expect(200);
  await request(app).head('/health').expect(200);
  assert.deepEqual(verified, ['invalid', 'foreign', 'no-user']);
  assert.deepEqual(calls, []);
});

test('verified users reach GET/POST exports without role checks and identity reaches selected services', async () => {
  const otherUser = {
    ...user,
    objectId: '44444444-4444-4444-8444-444444444444',
  };
  const { app, calls } = fixture({
    tenantId,
    verifyAccessToken: async (token) => ({
      ...(token === 'other' ? otherUser : user),
      accessToken: token,
    }),
  });
  await request(app)
    .get('/id.pdf')
    .set('Authorization', 'Bearer user')
    .expect(200);
  await request(app)
    .get('/api/exports/pdf')
    .set('Authorization', 'Bearer other')
    .query({ route: '/report' })
    .expect(200);
  await request(app)
    .post('/api/exports/pdf')
    .set('Authorization', 'Bearer user')
    .send({ route: '/report' })
    .expect(200);
  await request(app)
    .head('/api/exports/pdf')
    .set('Authorization', 'Bearer user')
    .query({ route: '/report' })
    .expect(200);
  for (const route of ['business', 'summary']) {
    const path = `/api/exports/pptx/jszip/${route}`;
    await request(app).get(path).expect(401);
    await request(app)
      .post(path)
      .send({ replacements: { title: 'Report' } })
      .expect(401);
    await request(app)
      .post(path)
      .set('Authorization', 'Bearer user')
      .send({ replacements: { title: 'Report' } })
      .expect(200);
    await request(app)
      .head(path)
      .set('Authorization', 'Bearer user')
      .query({ replacements: JSON.stringify({ title: 'Report' }) })
      .expect(200);
  }
  await request(app)
    .get('/api/exports/pptx/jszip/daa')
    .set('Authorization', 'Bearer user')
    .expect(200);
  await request(app).head('/api/exports/pptx/jszip/daa').expect(401);
  await request(app)
    .post('/api/exports/pptx/pptxgenjs/brief')
    .set('Authorization', 'Bearer user')
    .send({ title: 'Report', slides: [{ title: 'Slide', bullets: ['Text'] }] })
    .expect(200);
  assert.deepEqual(calls, [
    { route: 'pdf', context: { user } },
    { route: 'pdf', context: { user: otherUser } },
    { route: 'pdf', context: { user } },
    { route: 'business' },
    { route: 'summary' },
    { route: 'daa', context: { user } },
    { route: 'brief' },
  ]);
});

test('Entra placeholders reject tokens until verification is implemented and remain separate from UAMI', async () => {
  assert.deepEqual(loadAuthConfig({}), { mode: 'disabled' });
  assert.equal(createEntraAuthentication(loadAuthConfig({})), undefined);
  assert.throws(() => loadAuthConfig({ AUTH_MODE: 'typo' }));
  assert.throws(() => loadAuthConfig({ AUTH_MODE: 'entra' }));
  assert.throws(() =>
    loadAuthConfig({
      AUTH_MODE: 'entra',
      ENTRA_TENANT_ID: 'common',
      ENTRA_API_CLIENT_ID: audience,
    }),
  );
  const config = loadAuthConfig({
    AUTH_MODE: 'entra',
    ENTRA_TENANT_ID: tenantId,
    ENTRA_API_CLIENT_ID: audience,
    AZURE_CLIENT_ID: user.objectId,
  });
  assert.deepEqual(config, {
    mode: 'entra',
    tenantId,
    audience,
    scope: 'access_as_user',
  });
  const protectedApp = fixture(createEntraAuthentication(config));
  const response = await request(protectedApp.app)
    .get('/id.pdf')
    .set('Authorization', 'Bearer unverified')
    .expect(503);
  assert.equal(response.body.error.code, 'AUTH_NOT_CONFIGURED');
  assert.equal(response.headers['retry-after'], '5');
  assert.deepEqual(protectedApp.calls, []);
  await request(protectedApp.app).get('/health').expect(200);
  const open = fixture();
  await request(open.app).get('/id.pdf').expect(200);
  assert.deepEqual(open.calls, [
    { route: 'pdf', context: { user: undefined } },
  ]);
});
