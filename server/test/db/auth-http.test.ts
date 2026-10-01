import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import mongoose from 'mongoose';
import { hashPassword, loginKey } from '../../src/auth.js';
import { createApp } from '../../src/app.js';
import { deleteLimitKeys } from '../../src/login-limit.js';
import { Ledger } from '../../src/models/ledger.js';
import { Session } from '../../src/models/session.js';
import { User, openAccount } from '../../src/models/user.js';
import { ownProbe, probeName } from '../probe-name.js';

const password = 'correct-password';
const origin = 'http://localhost:4217';

let server: Server;
let base = '';
const userIds: mongoose.Types.ObjectId[] = [];
const limitKeys: string[] = [];

before(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('Нужен MONGODB_URI');
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20_000 });
  const leftovers = await User.find({ displayName: ownProbe('a') }, { _id: 1 });
  for (const leftover of leftovers) {
    await removeUser(leftover._id);
  }
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('сервер не поднялся');
  }
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  for (const id of userIds) await removeUser(id);
  await deleteLimitKeys(limitKeys);
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('новое имя probe_ не регистрируется', async () => {
  const name = probeName('a', 'r');
  limitKeys.push('ip:203.0.113.11', 'reg:203.0.113.11');
  const response = await post('/api/auth/register', '203.0.113.11', {
    username: name,
    password,
    adult: true,
  });
  assert.equal(response.status, 400);
  assert.equal(response.body?.error, 'username_reserved');
});

test('занятое имя probe_ отвечает, что логин занят', async () => {
  const name = probeName('a', '_t');
  const user = await openAccount({
    displayName: name,
    loginKey: loginKey(name),
    passwordHash: await hashPassword(password),
  });
  userIds.push(user._id);
  limitKeys.push('ip:203.0.113.12', 'reg:203.0.113.12', `login:${loginKey(name)}`);
  const response = await post('/api/auth/register', '203.0.113.12', {
    username: name,
    password,
    adult: true,
  });
  assert.equal(response.status, 409);
  assert.equal(response.body?.error, 'username_taken');
});

test('неверный пароль не пускает, верный пускает', async () => {
  const name = probeName('a', '_l');
  const user = await openAccount({
    displayName: name,
    loginKey: loginKey(name),
    passwordHash: await hashPassword(password),
  });
  userIds.push(user._id);
  limitKeys.push('ip:203.0.113.13', `login:${loginKey(name)}`);
  const wrong = await post('/api/auth/login', '203.0.113.13', { username: name, password: 'wrong-password' });
  const right = await post('/api/auth/login', '203.0.113.13', { username: name, password });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body?.error, 'invalid_credentials');
  assert.equal(right.status, 200);
  assert.equal(right.body?.displayName, name);
});

test('после пяти неверных паролей вход блокируется', async () => {
  const name = probeName('a', '_k');
  const user = await openAccount({
    displayName: name,
    loginKey: loginKey(name),
    passwordHash: await hashPassword(password),
  });
  userIds.push(user._id);
  const ip = '203.0.113.14';
  limitKeys.push(`ip:${ip}`, `login:${loginKey(name)}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await post('/api/auth/login', ip, { username: name, password: 'wrong-password' });
    assert.equal(response.status, 401);
  }
  const locked = await post('/api/auth/login', ip, { username: name, password });
  assert.equal(locked.status, 429);
  assert.equal(locked.body?.error, 'too_many_attempts');
  limitKeys.push(`ip:${ip}`, `login:${loginKey(name)}`);
});

async function post(path: string, ip: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as { error?: string; displayName?: string }) : null,
  };
}

async function removeUser(id: mongoose.Types.ObjectId) {
  await Ledger.deleteMany({ userId: id });
  await Session.deleteMany({ userId: id });
  await User.deleteOne({ _id: id });
}
