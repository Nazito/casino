import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { Session } from './models/session.js';

const COOKIE = 'sid';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const KEY_LENGTH = 64;

const USERNAME = /^[\p{L}\p{N}_-]{3,24}$/u;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const username = value.normalize('NFKC').trim();
  return USERNAME.test(username) ? username : null;
}

export function loginKey(username: string): string {
  return username.toLowerCase();
}

export function isProbeName(username: string): boolean {
  return loginKey(username).startsWith('probe_');
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, keyText] = stored.split('$');
  if (scheme !== 'scrypt' || !saltText || !keyText) {
    return false;
  }
  const expected = Buffer.from(keyText, 'base64url');
  const actual = await derive(password, Buffer.from(saltText, 'base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

let dummyHash: Promise<string> | null = null;

export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  await verifyPassword(password, await dummyHash);
}

export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  await Session.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS });
}

export async function readUserId(req: Request): Promise<string | null> {
  const token = readToken(req);
  if (!token) {
    return null;
  }
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  return session ? session.userId.toString() : null;
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = readToken(req);
  if (token) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
  res.clearCookie(COOKIE, cookieOptions());
}

function readToken(req: Request): string | null {
  const token = req.cookies?.[COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
  };
}
