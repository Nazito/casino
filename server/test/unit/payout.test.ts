import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NEON_FRUITS_SYMBOLS, type NeonFruitsSymbol, payout } from '../../src/games/neon-fruits.js';

const stake = 10;

const threeKind: Record<NeonFruitsSymbol, number> = {
  cherry: 8,
  lemon: 8,
  orange: 10,
  plum: 20,
  bell: 40,
  star: 80,
  seven: 150,
};

const pair: Record<NeonFruitsSymbol, number> = {
  cherry: 2,
  lemon: 0,
  orange: 2,
  plum: 0,
  bell: 0,
  star: 0,
  seven: 0,
};

test('три одинаковых символа платят по таблице', () => {
  for (const symbol of NEON_FRUITS_SYMBOLS) {
    assert.equal(payout([symbol, symbol, symbol], stake), stake * threeKind[symbol]);
  }
});

test('пара платит только у вишни и апельсина', () => {
  for (const symbol of NEON_FRUITS_SYMBOLS) {
    const other = symbol === 'cherry' ? 'lemon' : 'cherry';
    assert.equal(payout([symbol, other, symbol], stake), stake * pair[symbol]);
  }
});

test('три разных символа ничего не платят', () => {
  assert.equal(payout(['cherry', 'lemon', 'plum'], stake), 0);
});
