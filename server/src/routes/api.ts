import { Router } from 'express';
import mongoose from 'mongoose';
import { dbReady } from '../db.js';
import { STARTING_BALANCE, User, creditBalance, debitBalance } from '../models/user.js';

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true, database: dbReady() });
});

api.post('/users', async (req, res) => {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  if (!displayName || displayName.length > 40) {
    res.status(400).json({ error: 'invalid_display_name' });
    return;
  }

  const user = await User.create({ displayName, balance: STARTING_BALANCE });
  res.status(201).json(publicUser(user));
});

api.get('/users/:id', async (req, res) => {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'invalid_user_id' });
    return;
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'user_not_found' });
    return;
  }

  res.json(publicUser(user));
});

api.post('/wallet/credit', async (req, res) => {
  await changeBalance(req, res, 'credit');
});

api.post('/wallet/debit', async (req, res) => {
  await changeBalance(req, res, 'debit');
});

async function changeBalance(
  req: { body?: { userId?: unknown; amount?: unknown } },
  res: { status: (code: number) => { json: (body: unknown) => void } },
  direction: 'credit' | 'debit',
): Promise<void> {
  if (!dbReady()) {
    res.status(503).json({ error: 'database_unavailable' });
    return;
  }

  const userId = req.body?.userId;
  const amount = req.body?.amount;
  if (typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
    res.status(400).json({ error: 'invalid_user_id' });
    return;
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    res.status(400).json({ error: 'invalid_amount' });
    return;
  }

  const user =
    direction === 'debit' ? await debitBalance(userId, amount) : await creditBalance(userId, amount);

  if (!user) {
    const exists = await User.exists({ _id: userId });
    res.status(exists ? 409 : 404).json({
      error: exists ? 'insufficient_balance' : 'user_not_found',
    });
    return;
  }

  res.status(200).json(publicUser(user));
}

function publicUser(user: { _id: mongoose.Types.ObjectId; displayName: string; balance: number }) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    balance: user.balance,
  };
}
