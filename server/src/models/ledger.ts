import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['start', 'daily', 'spin'] },
  delta: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  stake: { type: Number },
  win: { type: Number },
  reels: { type: [String] },
  createdAt: { type: Date, required: true },
});

const SPIN_TTL_SECONDS = 90 * 24 * 60 * 60;

ledgerSchema.index({ userId: 1, createdAt: -1 });
// Spin rows expire. After that, summing the journal no longer equals the balance.
ledgerSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: SPIN_TTL_SECONDS, partialFilterExpression: { type: 'spin' } },
);

export const Ledger = mongoose.model('Ledger', ledgerSchema);
