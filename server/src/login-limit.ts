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

async function consume(key: string, max: number, lockOnMax: boolean): Promise<'ok' | 'locked'> {
  const now = new Date();
  const existing = await AuthLimit.findOne({ key });
  if (existing?.lockedUntil && existing.lockedUntil > now) {
    return 'locked';
  }

  const inWindow = !!existing && existing.windowEndsAt > now;
  if (!inWindow) {
    const windowEndsAt = new Date(now.getTime() + WINDOW_MS);
    await AuthLimit.findOneAndUpdate(
      { key },
      { $set: { count: 1, windowEndsAt, lockedUntil: null, expiresAt: windowEndsAt } },
      { upsert: true },
    );
    if (max <= 1 && lockOnMax) {
      await lockUntilNextWindow(key);
    }
    return 'ok';
  }

  if (existing.count >= max) {
    if (lockOnMax) {
      await lockUntilNextWindow(key);
    }
    return 'locked';
  }

  const updated = await AuthLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
  if (updated && updated.count >= max && lockOnMax) {
    await lockUntilNextWindow(key);
  }
  return updated && updated.count > max ? 'locked' : 'ok';
}

async function lockUntilNextWindow(key: string): Promise<void> {
  const lockedUntil = new Date(Date.now() + WINDOW_MS);
  await AuthLimit.updateOne(
    { key },
    { $set: { lockedUntil, windowEndsAt: lockedUntil, expiresAt: lockedUntil } },
  );
}

function address(ip: string | undefined): string {
  return ip && ip.length > 0 ? ip : 'unknown';
}
