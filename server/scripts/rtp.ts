import {
  NEON_FRUITS_SYMBOLS,
  NEON_FRUITS_WEIGHTS,
  payout as neonFruitsPayout,
  spinReels as neonFruitsSpin,
} from '../src/games/neon-fruits.js';

interface SlotGame {
  symbols: readonly string[];
  weights: Record<string, number>;
  reels: number;
  payout: (reels: readonly string[], stake: number) => number;
  spin: () => readonly string[];
}

const games: Record<string, SlotGame> = {
  'neon-fruits': {
    symbols: NEON_FRUITS_SYMBOLS,
    weights: NEON_FRUITS_WEIGHTS,
    reels: 3,
    payout: neonFruitsPayout as SlotGame['payout'],
    spin: neonFruitsSpin,
  },
};

const RTP_MIN = 0.94;
const RTP_MAX = 0.96;

const [slug = 'neon-fruits', spinsArg = '1000000'] = process.argv.slice(2);
const game = games[slug];
if (!game) {
  console.error(`Неизвестная игра "${slug}". Есть: ${Object.keys(games).join(', ')}`);
  process.exit(2);
}

const total = game.symbols.reduce((sum, symbol) => sum + game.weights[symbol]!, 0);
let rtp = 0;
let hit = 0;
let push = 0;
let maxMultiplier = 0;

for (const combo of combinations(game.symbols, game.reels)) {
  const probability = combo.reduce((p, symbol) => p * (game.weights[symbol]! / total), 1);
  const multiplier = game.payout(combo, 1);
  rtp += probability * multiplier;
  if (multiplier > 0) hit += probability;
  if (multiplier === 1) push += probability;
  maxMultiplier = Math.max(maxMultiplier, multiplier);
}

const spins = Number(spinsArg);
let returned = 0;
for (let i = 0; i < spins; i += 1) {
  returned += game.payout(game.spin(), 1);
}
const simulated = returned / spins;

console.log(`Игра: ${slug}`);
console.log(`RTP точный:        ${percent(rtp)}`);
console.log(`RTP симуляция:     ${percent(simulated)} (${spins} спинов)`);
console.log(`Частота выигрыша:  ${percent(hit)}`);
console.log(`Из них возврат 1×: ${percent(push)}`);
console.log(`Макс. множитель:   ${maxMultiplier}×`);

if (rtp < RTP_MIN || rtp > RTP_MAX) {
  console.error(`FAIL: RTP вне диапазона ${percent(RTP_MIN)}–${percent(RTP_MAX)}`);
  process.exit(1);
}
console.log('OK');

function* combinations(symbols: readonly string[], length: number): Generator<string[]> {
  if (length === 0) {
    yield [];
    return;
  }
  for (const symbol of symbols) {
    for (const rest of combinations(symbols, length - 1)) {
      yield [symbol, ...rest];
    }
  }
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
