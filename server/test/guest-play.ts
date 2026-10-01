import 'dotenv/config';
import mongoose from 'mongoose';
import {
  GUEST_SPINS,
  GUEST_STAKE,
  Guest,
  claimGuestTrial,
  clearGuestTrial,
  createGuest,
  mergeGuest,
  settleGuestSpin,
} from '../src/models/guest.js';
import { Ledger } from '../src/models/ledger.js';
import { User } from '../src/models/user.js';
import { ownProbe, probeName } from './probe-name.js';

const parallel = GUEST_SPINS + 10;
const ipKey = probeName('g', '_ip').slice(0, 40);

if (!process.env.MONGODB_URI) {
  console.error('Нужен MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20_000 });

const guestIds: mongoose.Types.ObjectId[] = [];
const userIds: mongoose.Types.ObjectId[] = [];
let closing = false;

async function finish(code: number) {
  if (closing) return;
  closing = true;
  try {
    for (const id of guestIds) await Guest.deleteOne({ _id: id });
    for (const id of userIds) {
      await Ledger.deleteMany({ userId: id });
      await User.deleteOne({ _id: id });
    }
    await clearGuestTrial(ipKey);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exit(code);
  }
}

process.once('SIGINT', () => {
  void finish(1);
});
process.once('SIGTERM', () => {
  void finish(1);
});

const leftovers = await User.find({ displayName: ownProbe('g') }, { _id: 1 });
for (const leftover of leftovers) {
  await Ledger.deleteMany({ userId: leftover._id });
  await User.deleteOne({ _id: leftover._id });
}
await clearGuestTrial(ipKey);

let failed = false;

try {
  const trial = await createGuest();
  guestIds.push(trial.guest._id);
  const empty = await Promise.allSettled(
    Array.from({ length: parallel }, (_, index) =>
      settleGuestSpin(trial.guest._id.toString(), 'neon-fruits', {
        stake: GUEST_STAKE,
        win: 0,
        reels: ['lemon', 'plum', 'orange'],
        createdAt: new Date(Date.now() + index),
      }),
    ),
  );
  const rejected = empty.filter((item) => item.status === 'rejected');
  const spent = empty.filter((item) => item.status === 'fulfilled' && item.value !== null);
  const afterEmpty = await Guest.findById(trial.guest._id);
  const emptyGame = afterEmpty?.games.find((game) => game.slug === 'neon-fruits');
  const emptyOk =
    rejected.length === 0 &&
    spent.length === GUEST_SPINS &&
    afterEmpty?.spinsLeft === 0 &&
    emptyGame?.balance === 0;

  const played = await createGuest();
  guestIds.push(played.guest._id);
  const first = await settleGuestSpin(played.guest._id.toString(), 'neon-fruits', {
    stake: GUEST_STAKE,
    win: 20,
    reels: ['cherry', 'cherry', 'lemon'],
    createdAt: new Date(),
  });
  const second = await settleGuestSpin(played.guest._id.toString(), 'neon-fruits', {
    stake: GUEST_STAKE,
    win: 0,
    reels: ['lemon', 'plum', 'orange'],
    createdAt: new Date(),
  });
  const third = await settleGuestSpin(played.guest._id.toString(), 'other', {
    stake: GUEST_STAKE,
    win: 40,
    reels: ['star', 'star', 'star'],
    createdAt: new Date(),
  });
  const neon = second?.games.find((game) => game.slug === 'neon-fruits');
  const other = third?.games.find((game) => game.slug === 'other');
  const playOk = first?.games[0]?.balance === 20 && neon?.balance === 10 && other?.balance === 40;

  const name = probeName('g');
  const user = await User.create({
    displayName: name,
    loginKey: name,
    passwordHash: 'probe',
    balance: 100,
    spins: [],
  });
  userIds.push(user._id);
  const merged = await mergeGuest(played.token, user._id.toString());
  const again = await mergeGuest(played.token, user._id.toString());
  const fresh = await User.findById(user._id);
  const rows = await Ledger.find({ userId: user._id, type: 'guest' });
  const mergeOk =
    merged?.absorbed === 50 &&
    again === null &&
    fresh?.balance === 150 &&
    rows.length === 1 &&
    rows[0]?.delta === 50 &&
    rows[0]?.balanceAfter === 150;

  let trials = 0;
  for (let index = 0; index < 6; index++) {
    if (await claimGuestTrial(ipKey)) trials += 1;
  }
  const quotaOk = trials === 5;

  failed = !emptyOk || !playOk || !mergeOk || !quotaOk;
  if (failed) {
    console.error(
      JSON.stringify({
        rejected: rejected.length,
        spent: spent.length,
        spinsLeft: afterEmpty?.spinsLeft ?? null,
        emptyBalance: emptyGame?.balance ?? null,
        neon: neon?.balance ?? null,
        other: other?.balance ?? null,
        absorbed: merged?.absorbed ?? null,
        again: again !== null,
        balance: fresh?.balance ?? null,
        ledgerRows: rows.length,
        trials,
      }),
    );
  } else {
    console.log(
      `OK: ${GUEST_SPINS} спинов из ${parallel}, проигрыш не уводит баланс ниже 0, две игры сложились в 50, повтор пустой, проб в сутки ${trials}`,
    );
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await finish(failed ? 1 : 0);
}
