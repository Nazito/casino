import 'dotenv/config';
import mongoose from 'mongoose';
import { Ledger } from '../src/models/ledger.js';
import { User, settleSpin } from '../src/models/user.js';

const stake = 10;
const spins = 20;
const affordable = 5;

if (!process.env.MONGODB_URI) {
  console.error('Нужен MONGODB_URI');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20_000 });

const name = `probe_parallel_${Date.now()}`;
const user = await User.create({
  displayName: name,
  loginKey: name,
  passwordHash: 'probe',
  balance: stake * affordable,
  spins: [],
});

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
  failed = rejected.length !== 0 || succeeded.length !== affordable || fresh?.balance !== 0;
  if (failed) {
    console.error(
      JSON.stringify({
        rejected: rejected.length,
        succeeded: succeeded.length,
        balance: fresh?.balance ?? null,
      }),
    );
  } else {
    console.log(`OK: ${succeeded.length} спинов из ${spins}, баланс ${fresh?.balance}, ошибок ${rejected.length}`);
  }
} finally {
  await Ledger.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });
  await mongoose.disconnect();
}

process.exit(failed ? 1 : 0);
