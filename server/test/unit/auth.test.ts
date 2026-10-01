import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isProbeName, normalizeUsername, validPassword } from '../../src/auth.js';

test('логин проходит проверку формата', () => {
  assert.equal(normalizeUsername('  Игрок_1 '), 'Игрок_1');
  assert.equal(normalizeUsername('ab'), null);
  assert.equal(normalizeUsername('имя с пробелом'), null);
  assert.equal(normalizeUsername(12), null);
});

test('пароль от 8 до 128 символов', () => {
  assert.equal(validPassword('1234567'), false);
  assert.equal(validPassword('12345678'), true);
  assert.equal(validPassword('x'.repeat(128)), true);
  assert.equal(validPassword('x'.repeat(129)), false);
});

test('имена probe_ зарезервированы без учёта регистра', () => {
  assert.equal(isProbeName('probe_player'), true);
  assert.equal(isProbeName('Probe_Player'), true);
  assert.equal(isProbeName('player'), false);
});
