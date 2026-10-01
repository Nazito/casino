import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
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
import { isNeonFruitsStake, payout, spinReels } from '../games/neon-fruits.js';
import { allowIp, allowRegistration, clearLoginFailures, loginBlocked, recordLoginFailure } from '../login-limit.js';
import { DAILY_GRANT, MIN_STAKE, User, canClaimDaily, claimDaily, openAccount, settleSpin } from '../models/user.js';

const registerBurst = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'too_many_attempts' });
  },
});

const spinBurst = rateLimit({
  windowMs: 60 * 1000,
  limit: 90,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'slow_down' });
  },
});

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

api.post('/auth/register', registerBurst, async (req, res) => {
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

  if (!(await allowIp(req.ip))) {
    res.status(429).json({ error: 'too_many_attempts' });
    return;
  }
  if (!(await allowRegistration(req.ip))) {
    res.status(429).json({ error: 'too_many_attempts' });
    return;
  }

  const key = loginKey(username);
  if (await User.exists({ $or: [{ loginKey: key }, { displayName: sameName(username) }] })) {
    res.status(409).json({ error: 'username_taken' });
    return;
  }

  let user;
  try {
    user = await openAccount({
      displayName: username,
      loginKey: key,
      passwordHash: await hashPassword(password),
    });
  } catch (error) {
    if (isDuplicate(error)) {
      res.status(409).json({ error: 'username_taken' });
      return;
    }
    throw error;
  }

  await clearLoginFailures(key);
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
  if (!(await allowIp(req.ip))) {
    res.status(429).json({ error: 'too_many_attempts' });
    return;
  }
  if (await loginBlocked(key)) {
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

  if (!user) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  if (!matches) {
    await recordLoginFailure(key);
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  await clearLoginFailures(key);
  await startSession(res, user._id.toString());
  res.json(publicUser(user));
});

api.post('/auth/logout', async (req, res) => {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  try {
    await endSession(req, res);
  } catch {
    res.status(503).json({ error: 'database_unavailable' });
    return;
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

  res.json({ granted: DAILY_GRANT, ...publicUser(updated) });
});

api.post('/games/neon-fruits/spin', spinBurst, async (req, res) => {
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
    dailyGrant: DAILY_GRANT,
    minStake: MIN_STAKE,
    spins,
  };
}

function sameName(username: string) {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { $regex: `^${escaped}$`, $options: 'i' };
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
