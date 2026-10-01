import mongoose from 'mongoose';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_ATTEMPTS = 20;
const MAX_LOGIN_FAILURES = 5;
const MAX_REGISTRATIONS = 3;

const authLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, required: true },
  windowEndsAt: { type: Date, required: true },
  lockedUntil: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  accepted: { type: Boolean, required: true },
});

authLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthLimit = mongoose.model('AuthLimit', authLimitSchema);

export async function allowIp(ip: string | undefined): Promise<boolean> {
  return (await consume(`ip:${address(ip)}`, MAX_IP_ATTEMPTS, false)) === 'ok';
}

export async function allowRegistration(ip: string | undefined): Promise<boolean> {
  return (await consume(`reg:${address(ip)}`, MAX_REGISTRATIONS, true)) === 'ok';
}

export async function loginBlocked(login: string): Promise<boolean> {
  const doc = await AuthLimit.findOne({ key: `login:${login}` });
  return !!doc?.lockedUntil && doc.lockedUntil.getTime() > Date.now();
}

export async function recordLoginFailure(login: string): Promise<void> {
  await consume(`login:${login}`, MAX_LOGIN_FAILURES, true);
}

export async function clearLoginFailures(login: string): Promise<void> {
  await AuthLimit.deleteOne({ key: `login:${login}` });
}

export async function deleteLimitKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await AuthLimit.deleteMany({ key: { $in: keys } });
}

async function consume(key: string, max: number, lockOnMax: boolean): Promise<'ok' | 'locked'> {
  const now = new Date();
  const nextWindow = new Date(now.getTime() + WINDOW_MS);
  const locked = { $gt: [{ $ifNull: ['$lockedUntil', new Date(0)] }, now] };
  const expired = { $lte: [{ $ifNull: ['$windowEndsAt', new Date(0)] }, now] };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const updated = await AuthLimit.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              accepted: {
                $cond: [locked, false, { $cond: [expired, true, { $lt: [{ $ifNull: ['$count', 0] }, max] }] }],
              },
            },
          },
          {
            $set: {
              count: {
                $cond: [
                  '$accepted',
                  { $cond: [expired, 1, { $add: [{ $ifNull: ['$count', 0] }, 1] }] },
                  { $ifNull: ['$count', 0] },
                ],
              },
              windowEndsAt: {
                $cond: [{ $and: ['$accepted', expired] }, nextWindow, { $ifNull: ['$windowEndsAt', nextWindow] }],
              },
              expiresAt: {
                $cond: [{ $and: ['$accepted', expired] }, nextWindow, { $ifNull: ['$expiresAt', nextWindow] }],
              },
              lockedUntil: {
                $cond: [locked, '$lockedUntil', null],
              },
            },
          },
          {
            $set: {
              lockedUntil: {
                $cond: [{ $and: [lockOnMax, '$accepted', { $gte: ['$count', max] }] }, nextWindow, '$lockedUntil'],
              },
              windowEndsAt: {
                $cond: [{ $and: [lockOnMax, '$accepted', { $gte: ['$count', max] }] }, nextWindow, '$windowEndsAt'],
              },
              expiresAt: {
                $cond: [{ $and: [lockOnMax, '$accepted', { $gte: ['$count', max] }] }, nextWindow, '$expiresAt'],
              },
            },
          },
        ],
        { upsert: true, new: true },
      );
      if (!updated?.accepted || updated.count > max) {
        return 'locked';
      }
      return 'ok';
    } catch (error) {
      if (isDuplicate(error) && attempt < 2) {
        continue;
      }
      if (isDuplicate(error)) {
        return 'locked';
      }
      throw error;
    }
  }

  return 'locked';
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function address(ip: string | undefined): string {
  return ip && ip.length > 0 ? ip : 'unknown';
}
