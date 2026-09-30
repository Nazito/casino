import { Router, type Request } from 'express';
import mongoose from 'mongoose';
import {
  PASSWORD_MAX,
  burnPasswordCheck,
  endSession,
  hashPassword,
  loginKey,
  normalizeUsername,
  readUserId,
  startSession,
  validPassword,
  verifyPassword,
} from '../auth.js';
import { dbReady } from '../db.js';
import { clearFailures, isLocked, recordFailure } from '../login-limit.js';
import { isNeonFruitsStake, payout, spinReels } from '../games/neon-fruits.js';
import { MIN_STAKE, STARTING_BALANCE, User, canClaimDaily, claimDaily, settleSpin } from '../models/user.js';

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, database: dbReady() });
});

api.get('/session', async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) {
    return;
  }
  res.json(publicUser(user));
});

api.post('/auth/register', async (req, res) => {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  const username = normalizeUsername(req.body?.username);
  if (!username) {
    res.status(400).json({ error: 'invalid_username' });
    return;
  }
  const password = req.body?.password;
  if (!validPassword(password)) {
    res.status(400).json({ error: 'invalid_password' });
    return;
  }

  const key = loginKey(username);
  if (await User.exists({ $or: [{ loginKey: key }, { displayName: username }] })) {
    res.status(409).json({ error: 'username_taken' });
    return;
  }

  let user;
  try {
    user = await User.create({
      displayName: username,
      loginKey: key,
      passwordHash: await hashPassword(password),
      balance: STARTING_BALANCE,
      spins: [],
    });
  } catch (error) {
    if (isDuplicate(error)) {
      res.status(409).json({ error: 'username_taken' });
      return;
    }
    throw error;
  }

  await startSession(res, user._id.toString());
  res.status(201).json(publicUser(user));
});

api.post('/auth/login', async (req, res) => {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  const username = normalizeUsername(req.body?.username);
  const password = req.body?.password;
  if (!username || typeof password !== 'string' || password.length > PASSWORD_MAX) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const key = loginKey(username);
  const limitKey = `${req.ip ?? ''}:${key}`;
  if (isLocked(limitKey)) {
    res.status(429).json({ error: 'too_many_attempts' });
    return;
  }

  const user = await User.findOne({ loginKey: key }).select('+passwordHash');
  let matches = false;
  if (user?.passwordHash) {
    matches = await verifyPassword(password, user.passwordHash);
  } else {
    await burnPasswordCheck(password);
  }

  if (!user || !matches) {
    recordFailure(limitKey);
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  clearFailures(limitKey);
  await startSession(res, user._id.toString());
  res.json(publicUser(user));
});

api.post('/auth/logout', async (req, res) => {
  if (dbReady()) {
    await endSession(req, res);
  }
  res.status(204).end();
});

api.post('/wallet/daily', async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) {
    return;
  }

  const updated = await claimDaily(user._id.toString());
  if (!updated) {
    const fresh = await User.findById(user._id);
    res.status(409).json({
      error: fresh && fresh.balance >= MIN_STAKE ? 'daily_not_needed' : 'daily_already_claimed',
    });
    return;
  }

  res.json(publicUser(updated));
});

api.post('/games/neon-fruits/spin', async (req, res) => {
  const user = await currentUser(req, res);
  if (!user) {
    return;
  }

  const stake = req.body?.stake;
  if (typeof stake !== 'number' || !isNeonFruitsStake(stake)) {
    res.status(400).json({ error: 'invalid_stake' });
    return;
  }

  const reels = spinReels();
  const win = payout(reels, stake);
  const updated = await settleSpin(user._id.toString(), {
    stake,
    win,
    reels: [...reels],
    createdAt: new Date(),
  });

  if (!updated) {
    res.status(409).json({ error: 'insufficient_balance' });
    return;
  }

  res.json({
    reels,
    stake,
    win,
    ...publicUser(updated),
  });
});

async function currentUser(
  req: Request,
  res: { status: (code: number) => { json: (body: unknown) => void } },
) {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return null;
  }

  const userId = await readUserId(req);
  if (!userId || !mongoose.isValidObjectId(userId)) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  return user;
}

function publicUser(user: {
  _id: mongoose.Types.ObjectId;
  displayName: string;
  balance: number;
  lastDailyKey?: string | null;
  spins?: { stake: number; win: number; reels: string[]; createdAt: Date }[];
}) {
  const spins = [...(user.spins ?? [])].reverse();
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    balance: user.balance,
    dailyAvailable: canClaimDaily(user.balance, user.lastDailyKey),
    spins,
  };
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
