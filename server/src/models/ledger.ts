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

ledgerSchema.index({ userId: 1, createdAt: -1 });

export const Ledger = mongoose.model('Ledger', ledgerSchema);
