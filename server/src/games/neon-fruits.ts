import { randomInt } from 'node:crypto';

export const NEON_FRUITS_STAKES = [10, 50, 100, 500] as const;

export type NeonFruitsStake = (typeof NEON_FRUITS_STAKES)[number];

export const NEON_FRUITS_SYMBOLS = ['cherry', 'lemon', 'orange', 'plum', 'bell', 'star', 'seven'] as const;

export type NeonFruitsSymbol = (typeof NEON_FRUITS_SYMBOLS)[number];

const WEIGHTS: Record<NeonFruitsSymbol, number> = {
  cherry: 20,
  lemon: 18,
  orange: 16,
  plum: 12,
  bell: 8,
  star: 5,
  seven: 3,
};

const THREE_KIND: Record<NeonFruitsSymbol, number> = {
  cherry: 4,
  lemon: 5,
  orange: 8,
  plum: 10,
  bell: 15,
  star: 20,
  seven: 50,
};

const PAIR: Record<NeonFruitsSymbol, number> = {
  cherry: 2,
  lemon: 1,
  orange: 1,
  plum: 1,
  bell: 1,
  star: 1,
  seven: 1,
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
  const total = NEON_FRUITS_SYMBOLS.reduce((sum, symbol) => sum + WEIGHTS[symbol], 0);
  let roll = randomInt(total);

  for (const symbol of NEON_FRUITS_SYMBOLS) {
    if (roll < WEIGHTS[symbol]) {
      return symbol;
    }
    roll -= WEIGHTS[symbol];
  }

  return 'cherry';
}
