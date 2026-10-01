import 'dotenv/config';
import mongoose from 'mongoose';
import { Ledger } from '../src/models/ledger.js';
import { User, settleSpin } from '../src/models/user.js';
import { ownProbe, probeName } from './probe-name.js';

const stake = 10;
const spins = 20;
const affordable = 5;

if (!process.env.MONGODB_URI) {
  console.error('Нужен MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20_000 });

let userId: mongoose.Types.ObjectId | null = null;
let closing = false;

async function removeUser(id: mongoose.Types.ObjectId) {
  await Ledger.deleteMany({ userId: id });
  await User.deleteOne({ _id: id });
}

async function finish(code: number) {
  if (closing) return;
  closing = true;
  try {
    if (userId) await removeUser(userId);
  } finally {
    userId = null;
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

const leftovers = await User.find({ displayName: ownProbe('p') }, { _id: 1 });
for (const leftover of leftovers) {
  await removeUser(leftover._id);
}
if (leftovers.length > 0) {
  console.log(`Убраны пробные аккаунты этого прогона: ${leftovers.length}`);
}

const name = probeName('p');
const user = await User.create({
  displayName: name,
  loginKey: name,
  passwordHash: 'probe',
  balance: stake * affordable,
  spins: [],
});
userId = user._id;

let failed = false;

try {
  const settled = await Promise.allSettled(
    Array.from({ length: spins }, (_, index) =>
      settleSpin(user._id.toString(), {
        stake,
        win: 0,
        reels: ['lemon', 'plum', 'orange'],
        createdAt: new Date(Date.now() + index),
      }),
    ),
  );
  const rejected = settled.filter((item) => item.status === 'rejected');
  const succeeded = settled.filter((item) => item.status === 'fulfilled' && item.value !== null);
  const fresh = await User.findById(user._id);
  const rows = await Ledger.find({ userId: user._id });
  const deltaSum = rows.reduce((sum, row) => sum + row.delta, 0);
  const ledgerOk =
    rows.length === affordable && rows.every((row) => row.type === 'spin') && deltaSum === -stake * affordable;
  failed = rejected.length !== 0 || succeeded.length !== affordable || fresh?.balance !== 0 || !ledgerOk;
  if (failed) {
    console.error(
      JSON.stringify({
        rejected: rejected.length,
        succeeded: succeeded.length,
        balance: fresh?.balance ?? null,
        ledgerRows: rows.length,
        deltaSum,
      }),
    );
  } else {
    console.log(
      `OK: ${succeeded.length} спинов из ${spins}, баланс ${fresh?.balance}, строк журнала ${rows.length}, ошибок ${rejected.length}`,
    );
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await finish(failed ? 1 : 0);
}
