import mongoose, { InferSchemaType } from 'mongoose';
import { Ledger } from './ledger.js';

const spinSchema = new mongoose.Schema(
  {
    stake: { type: Number, required: true },
    win: { type: Number, required: true },
    reels: { type: [String], required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 40,
      unique: true,
    },
    loginKey: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    balance: { type: Number, required: true, min: 0, default: 0 },
    lastDailyKey: { type: String, default: '' },
    spins: { type: [spinSchema], default: [] },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User = mongoose.model('User', userSchema);

export const STARTING_BALANCE = 10_000;
export const MIN_STAKE = 10;
export const DAILY_GRANT = 2_000;

export function kyivDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function canClaimDaily(balance: number, lastDailyKey: string | null | undefined, now = new Date()): boolean {
  return balance < MIN_STAKE && (lastDailyKey ?? '') !== kyivDay(now);
}

export interface SpinRecord {
  stake: number;
  win: number;
  reels: string[];
  createdAt: Date;
}

export async function openAccount(fields: { displayName: string; loginKey: string; passwordHash: string }) {
  return inTransaction(async (session) => {
    const [user] = await User.create([{ ...fields, balance: STARTING_BALANCE, spins: [] }], { session });
    if (!user) {
      throw new Error('account was not created');
    }
    await Ledger.create(
      [
        {
          userId: user._id,
          type: 'start',
          delta: STARTING_BALANCE,
          balanceAfter: user.balance,
          createdAt: new Date(),
        },
      ],
      { session },
    );
    return user;
  });
}

export async function claimDaily(userId: string, now = new Date()) {
  return inTransaction(async (session) => {
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        balance: { $lt: MIN_STAKE },
        lastDailyKey: { $ne: kyivDay(now) },
      },
      { $inc: { balance: DAILY_GRANT }, $set: { lastDailyKey: kyivDay(now) } },
      { new: true, session },
    );
    if (!updated) {
      return null;
    }
    await Ledger.create(
      [
        {
          userId: updated._id,
          type: 'daily',
          delta: DAILY_GRANT,
          balanceAfter: updated.balance,
          createdAt: new Date(),
        },
      ],
      { session },
    );
    return updated;
  });
}

export async function settleSpin(userId: string, spin: SpinRecord) {
  return inTransaction(async (session) => {
    const updated = await User.findOneAndUpdate(
      { _id: userId, balance: { $gte: spin.stake } },
      {
        $inc: { balance: spin.win - spin.stake },
        $push: {
          spins: {
            $each: [spin],
            $slice: -20,
          },
        },
      },
      { new: true, session },
    );
    if (!updated) {
      return null;
    }
    await Ledger.create(
      [
        {
          userId: updated._id,
          type: 'spin',
          delta: spin.win - spin.stake,
          balanceAfter: updated.balance,
          stake: spin.stake,
          win: spin.win,
          reels: spin.reels,
          createdAt: spin.createdAt,
        },
      ],
      { session },
    );
    return updated;
  });
}

async function inTransaction<T>(work: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
