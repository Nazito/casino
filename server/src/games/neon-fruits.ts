import { randomInt } from 'node:crypto';

export const NEON_FRUITS_STAKES = [10, 50, 100, 500] as const;

export type NeonFruitsStake = (typeof NEON_FRUITS_STAKES)[number];

export const NEON_FRUITS_SYMBOLS = ['cherry', 'lemon', 'orange', 'plum', 'bell', 'star', 'seven'] as const;

export type NeonFruitsSymbol = (typeof NEON_FRUITS_SYMBOLS)[number];

export const NEON_FRUITS_WEIGHTS: Record<NeonFruitsSymbol, number> = {
  cherry: 30,
  lemon: 22,
  orange: 16,
  plum: 12,
  bell: 10,
  star: 6,
  seven: 4,
};

const THREE_KIND: Record<NeonFruitsSymbol, number> = {
  cherry: 8,
  lemon: 8,
  orange: 10,
  plum: 20,
  bell: 40,
  star: 80,
  seven: 150,
};

const PAIR: Record<NeonFruitsSymbol, number> = {
  cherry: 2,
  lemon: 0,
  orange: 2,
  plum: 0,
  bell: 0,
  star: 0,
  seven: 0,
};

export function isNeonFruitsStake(value: number): value is NeonFruitsStake {
  return (NEON_FRUITS_STAKES as readonly number[]).includes(value);
}

export function spinReels(): [NeonFruitsSymbol, NeonFruitsSymbol, NeonFruitsSymbol] {
  return [pickSymbol(), pickSymbol(), pickSymbol()];
}

export function payout(reels: readonly NeonFruitsSymbol[], stake: number): number {
  const [first, second, third] = reels;
  if (first === second && second === third && first) {
    return stake * THREE_KIND[first];
  }

  const counts = new Map<NeonFruitsSymbol, number>();
  for (const symbol of reels) {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }

  for (const [symbol, count] of counts) {
    if (count === 2) {
      return stake * PAIR[symbol];
    }
  }

  return 0;
}

function pickSymbol(): NeonFruitsSymbol {
  const total = NEON_FRUITS_SYMBOLS.reduce((sum, symbol) => sum + NEON_FRUITS_WEIGHTS[symbol], 0);
  let roll = randomInt(total);

  for (const symbol of NEON_FRUITS_SYMBOLS) {
    if (roll < NEON_FRUITS_WEIGHTS[symbol]) {
      return symbol;
    }
    roll -= NEON_FRUITS_WEIGHTS[symbol];
  }

  return 'cherry';
}
