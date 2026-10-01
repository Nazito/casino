import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import mongoose from 'mongoose';
import { MIN_STAKE, UserDocument, addGuestTake, kyivDay } from './user.js';

export const GUEST_SPINS = 50;
export const GUEST_STAKE = MIN_STAKE;
const GUEST_MS = 7 * 24 * 60 * 60 * 1000;
const GUEST_TRIALS_PER_DAY = 5;
const COOKIE = 'gid';

const spinSchema = new mongoose.Schema(
  {
    stake: { type: Number, required: true },
    win: { type: Number, required: true },
    reels: { type: [String], required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const gameSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true },
    balance: { type: Number, required: true, min: 0 },
    spins: { type: [spinSchema], default: [] },
  },
  { _id: false },
);

const guestSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  spinsLeft: { type: Number, required: true, min: 0 },
  games: { type: [gameSchema], default: [] },
  mergedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, expires: 0 },
});

const quotaSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const Guest = mongoose.model('Guest', guestSchema);
const GuestQuota = mongoose.model('GuestQuota', quotaSchema);

export interface GuestSpinRecord {
  stake: number;
  win: number;
  reels: string[];
  createdAt: Date;
}

type GuestGame = {
  slug: string;
  balance: number;
  spins?: GuestSpinRecord[];
};

export type GuestDocument = {
  _id: mongoose.Types.ObjectId;
  spinsLeft: number;
  games: GuestGame[];
  mergedAt?: Date | null;
};

export async function claimGuestTrial(ipKey: string): Promise<boolean> {
  const key = guestQuotaKey(ipKey);
  const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const updated = await GuestQuota.findOneAndUpdate(
        { key, count: { $lt: GUEST_TRIALS_PER_DAY } },
        { $inc: { count: 1 }, $set: { expiresAt } },
        { new: true, upsert: true },
      );
      return !!updated;
    } catch (error) {
      if (!isDuplicate(error)) {
        throw error;
      }
    }
  }
  return false;
}

export async function clearGuestTrial(ipKey: string): Promise<void> {
  await GuestQuota.deleteOne({ key: guestQuotaKey(ipKey) });
}

export async function createGuest(): Promise<{ guest: GuestDocument; token: string }> {
  const token = randomBytes(32).toString('base64url');
  const guest = await Guest.create({
    tokenHash: hashToken(token),
    spinsLeft: GUEST_SPINS,
    games: [],
    mergedAt: null,
    expiresAt: new Date(Date.now() + GUEST_MS),
  });
  return { guest, token };
}

export async function findGuest(token: string | null): Promise<GuestDocument | null> {
  if (!token) {
    return null;
  }
  return Guest.findOne({
    tokenHash: hashToken(token),
    mergedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

export async function settleGuestSpin(guestId: string, slug: string, spin: GuestSpinRecord) {
  if (spin.stake !== GUEST_STAKE || spin.win < 0 || !slug) {
    return null;
  }

  return inTransaction(async (session) => {
    const open = {
      _id: guestId,
      mergedAt: null,
      expiresAt: { $gt: new Date() },
      spinsLeft: { $gte: 1 },
    };

    const funded = await Guest.findOneAndUpdate(
      { ...open, games: { $elemMatch: { slug, balance: { $gte: spin.stake } } } },
      {
        $inc: { spinsLeft: -1, 'games.$.balance': spin.win - spin.stake },
        $push: { 'games.$.spins': { $each: [spin], $slice: -20 } },
      },
      { new: true, session },
    );
    if (funded) {
      return funded;
    }

    const opened = await Guest.findOneAndUpdate(
      { ...open, games: { $not: { $elemMatch: { slug } } } },
      {
        $inc: { spinsLeft: -1 },
        $push: { games: { slug, balance: spin.win, spins: [spin] } },
      },
      { new: true, session },
    );
    if (opened) {
      return opened;
    }

    return Guest.findOneAndUpdate(
      { ...open, games: { $elemMatch: { slug, balance: 0 } } },
      {
        $inc: { spinsLeft: -1, 'games.$.balance': spin.win },
        $push: { 'games.$.spins': { $each: [spin], $slice: -20 } },
      },
      { new: true, session },
    );
  });
}

export async function mergeGuest(
  token: string,
  userId: string,
): Promise<{ user: UserDocument; absorbed: number } | null> {
  const tokenHash = hashToken(token);
  return inTransaction(async (session) => {
    const guest = await Guest.findOneAndUpdate(
      { tokenHash, mergedAt: null },
      { $set: { mergedAt: new Date(), spinsLeft: 0 } },
      { new: false, session },
    );
    if (!guest) {
      return null;
    }
    const absorbed = guest.games.reduce((sum, game) => sum + game.balance, 0);
    const user = await addGuestTake(userId, absorbed, session);
    if (!user) {
      throw new Error('account was not found');
    }
    return { user, absorbed };
  });
}

export function publicGuest(guest: GuestDocument, slug: string) {
  const game = guest.games.find((item) => item.slug === slug);
  const spins = [...(game?.spins ?? [])].reverse();
  return {
    guest: true as const,
    spinsLeft: guest.spinsLeft,
    spinLimit: GUEST_SPINS,
    stake: GUEST_STAKE,
    balance: game?.balance ?? 0,
    total: guest.games.reduce((sum, item) => sum + item.balance, 0),
    minStake: GUEST_STAKE,
    spins,
  };
}

export function readGuestToken(req: Request): string | null {
  const token = req.cookies?.[COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export function setGuestCookie(res: Response, token: string): void {
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: GUEST_MS });
}

export function clearGuestCookie(res: Response): void {
  res.clearCookie(COOKIE, cookieOptions());
}

function guestQuotaKey(ipKey: string): string {
  return `guest:${ipKey}:${kyivDay()}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
  };
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
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
