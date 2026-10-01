import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { after, test } from 'node:test';
import { createApp } from '../../src/app.js';

let server: Server;
let base = '';

test('без базы health отвечает 503', async () => {
  server = createApp().listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('сервер не поднялся');
  }
  base = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, database: false });
});

test('в одном процессе свой Origin принимается, чужой нет', async () => {
  const same = createApp({ sameOrigin: true }).listen(0);
  await once(same, 'listening');
  const address = same.address();
  if (!address || typeof address === 'string') {
    throw new Error('сервер не поднялся');
  }
  const url = `http://127.0.0.1:${address.port}`;
  const accepted = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify({ username: 'player', password: 'wrong-password' }),
  });
  const rejected = await fetch(`${url}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
    body: JSON.stringify({ username: 'player', password: 'wrong-password' }),
  });
  assert.equal(accepted.status, 503);
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error, 'bad_origin');
  await new Promise<void>((resolve, reject) => same.close((error) => (error ? reject(error) : resolve())));
});

after(async () => {
  if (!server) {
    return;
  }
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});
