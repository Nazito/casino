import mongoose, { InferSchemaType } from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 40 },
    balance: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };

export const User = mongoose.model('User', userSchema);

export const STARTING_BALANCE = 10_000;

export async function creditBalance(userId: string, amount: number) {
  return User.findOneAndUpdate({ _id: userId }, { $inc: { balance: amount } }, { new: true });
}

export async function debitBalance(userId: string, amount: number) {
  return User.findOneAndUpdate(
    { _id: userId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true },
  );
}
