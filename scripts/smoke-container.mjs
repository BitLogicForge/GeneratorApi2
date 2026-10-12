import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';

const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = createServer((req, res) => {
  assert.equal(req.url, '/documents/id2222?language=en');
  res.setHeader('Content-Type', 'text/html');
  res.end('<html><body><h1>Container PDF smoke test</h1></body></html>');
});
const reservation = createServer();
let server;
let logs = '';

try {
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));

  server = spawn(process.execPath, ['dist/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(port),
      WEBAPP_BASE_URL: `http://127.0.0.1:${upstream.address().port}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => (logs += chunk.toString()));
  server.stderr.on('data', (chunk) => (logs += chunk.toString()));
  server.on('error', (error) => (logs += error.message));
  const baseUrl = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, logs);
    assert.equal(server.signalCode, null, logs);
    const response = await fetch(`${baseUrl}/internal/ready`, {
      signal: AbortSignal.timeout(1000),
    }).catch(() => undefined);
    if (response?.ok) {
      ready = true;
      break;
    }
    await delay(200);
  }
  assert.ok(ready, `Container API did not become ready: ${logs}`);

  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const pptx = await fetch(
    `${baseUrl}/api/exports/pptx/jszip/daa?TEXT_ME=Container%20smoke%20test`,
  );
  assert.equal(pptx.status, 200, pptx.ok ? '' : await pptx.text());
  const deck = await JSZip.loadAsync(await pptx.arrayBuffer());
  assert.match(
    await deck.file('ppt/slides/slide1.xml').async('string'),
    /Container smoke test/,
  );

  const pdf = await fetch(`${baseUrl}/api/exports/pdf/portrait/id2222.pdf`);
  assert.equal(pdf.status, 200, pdf.ok ? '' : await pdf.text());
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    '%PDF-',
  );
  console.log('Container smoke test passed: readiness, health, PPTX, and PDF.');
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'exit');
    const deadline = setTimeout(() => server.kill('SIGKILL'), 16000).unref();
    server.kill('SIGTERM');
    await exited;
    clearTimeout(deadline);
  }
  if (reservation.listening)
    await new Promise((resolve) => reservation.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
}
