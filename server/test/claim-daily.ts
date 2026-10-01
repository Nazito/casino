import 'dotenv/config';
import mongoose from 'mongoose';
import { Ledger } from '../src/models/ledger.js';
import { DAILY_GRANT, MIN_STAKE, User, claimDaily } from '../src/models/user.js';
import { ownProbe, probeName } from './probe-name.js';

const attempts = 10;

if (!process.env.MONGODB_URI) {
  console.error('Нужен MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20_000 });

const userIds: mongoose.Types.ObjectId[] = [];
let closing = false;

async function removeUser(id: mongoose.Types.ObjectId) {
  await Ledger.deleteMany({ userId: id });
  await User.deleteOne({ _id: id });
}

async function finish(code: number) {
  if (closing) return;
  closing = true;
  try {
    for (const id of userIds) await removeUser(id);
  } finally {
    userIds.length = 0;
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

const leftovers = await User.find({ displayName: ownProbe('d') }, { _id: 1 });
for (const leftover of leftovers) {
  await removeUser(leftover._id);
}
if (leftovers.length > 0) {
  console.log(`Убраны пробные аккаунты этого прогона: ${leftovers.length}`);
}

const now = new Date();
const fundedName = probeName('d', '_f');
const emptyName = probeName('d', '_e');

const funded = await User.create({
  displayName: fundedName,
  loginKey: fundedName,
  passwordHash: 'probe',
  balance: MIN_STAKE,
  spins: [],
});
userIds.push(funded._id);

const empty = await User.create({
  displayName: emptyName,
  loginKey: emptyName,
  passwordHash: 'probe',
  balance: 0,
  spins: [],
});
userIds.push(empty._id);

let failed = false;

try {
  const blocked = await claimDaily(funded._id.toString(), now);
  const fundedFresh = await User.findById(funded._id);
  const fundedRows = await Ledger.find({ userId: funded._id });

  const settled = await Promise.allSettled(
    Array.from({ length: attempts }, () => claimDaily(empty._id.toString(), now)),
  );
  const rejected = settled.filter((item) => item.status === 'rejected');
  const granted = settled.filter((item) => item.status === 'fulfilled' && item.value !== null);
  const emptyFresh = await User.findById(empty._id);
  const rows = await Ledger.find({ userId: empty._id });
  const again = await claimDaily(empty._id.toString(), now);

  const fundedOk = blocked === null && fundedFresh?.balance === MIN_STAKE && fundedRows.length === 0;
  const emptyOk =
    rejected.length === 0 &&
    granted.length === 1 &&
    emptyFresh?.balance === DAILY_GRANT &&
    again === null &&
    rows.length === 1 &&
    rows[0]?.type === 'daily' &&
    rows[0]?.delta === DAILY_GRANT &&
    rows[0]?.balanceAfter === DAILY_GRANT;
  failed = !fundedOk || !emptyOk;
  if (failed) {
    console.error(
      JSON.stringify({
        blocked: blocked !== null,
        fundedBalance: fundedFresh?.balance ?? null,
        fundedRows: fundedRows.length,
        rejected: rejected.length,
        granted: granted.length,
        emptyBalance: emptyFresh?.balance ?? null,
        again: again !== null,
        ledgerRows: rows.length,
        delta: rows[0]?.delta ?? null,
      }),
    );
  } else {
    console.log(
      `OK: грант не выдан при балансе ${MIN_STAKE}, из ${attempts} пустых запросов выдан 1, баланс ${emptyFresh?.balance}, повтор пустой`,
    );
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await finish(failed ? 1 : 0);
}
