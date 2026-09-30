import mongoose, { InferSchemaType } from 'mongoose';

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

export async function claimDaily(userId: string, now = new Date()) {
  return User.findOneAndUpdate(
    {
      _id: userId,
      balance: { $lt: MIN_STAKE },
      lastDailyKey: { $ne: kyivDay(now) },
    },
    { $inc: { balance: DAILY_GRANT }, $set: { lastDailyKey: kyivDay(now) } },
    { new: true },
  );
}

export async function settleSpin(userId: string, spin: SpinRecord) {
  return User.findOneAndUpdate(
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
    { new: true },
  );
}
