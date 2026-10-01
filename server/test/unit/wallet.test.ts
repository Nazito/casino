import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canClaimDaily, kyivDay } from '../../src/models/user.js';

test('киевские сутки сменяются в полночь по Киеву', () => {
  assert.equal(kyivDay(new Date('2026-01-15T21:30:00Z')), '2026-01-15');
  assert.equal(kyivDay(new Date('2026-01-15T22:30:00Z')), '2026-01-16');
  assert.equal(kyivDay(new Date('2026-07-15T20:30:00Z')), '2026-07-15');
  assert.equal(kyivDay(new Date('2026-07-15T21:30:00Z')), '2026-07-16');
});

test('дневной бонус только при балансе ниже минимальной ставки и один раз за сутки', () => {
  const sameDay = new Date('2026-01-15T21:30:00Z');
  const nextDay = new Date('2026-01-15T22:30:00Z');

  assert.equal(canClaimDaily(0, '', sameDay), true);
  assert.equal(canClaimDaily(9, '', sameDay), true);
  assert.equal(canClaimDaily(10, '', sameDay), false);
  assert.equal(canClaimDaily(0, '2026-01-15', sameDay), false);
  assert.equal(canClaimDaily(0, '2026-01-15', nextDay), true);
  assert.equal(canClaimDaily(10, '2026-01-15', nextDay), false);
});
