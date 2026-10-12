import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../config';
import type { Db, Row } from '../../lib/db';
import { serviceUnavailable } from '../../lib/errors';

const emailSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(120).optional(),
});
const verifySchema = emailSchema.extend({ code: z.string().regex(/^\d{6}$/) });

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

async function hash(value: string) {
  return bytesToBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  );
}

async function token(userId: string, secret: string) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 }),
  );
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)),
  );
  return `${data}.${bytesToBase64Url(signature)}`;
}

async function sendOtp(apiKey: string, from: string, email: string, code: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your GramLedger sign-in code',
      text: `Your GramLedger sign-in code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!response.ok) throw serviceUnavailable('We could not send the sign-in code');
}

export const authRouter = new Hono<AppEnv>();

authRouter.post('/auth/request-otp', zValidator('json', emailSchema), async (c) => {
  const db = c.get('db') as Db | undefined;
  const apiKey = c.env.RESEND_API_KEY;
  const from = c.env.AUTH_FROM_EMAIL;
  const isDevelopment = c.env.ENVIRONMENT === 'development';
  if (!db || (!isDevelopment && (!apiKey || !from))) {
    throw serviceUnavailable('Email sign-in is not configured');
  }
  const { email, name } = c.req.valid('json');
  const normalizedEmail = email.toLowerCase();
  const rows = await db.query(
    'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT ((lower(email))) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name) RETURNING id',
    [normalizedEmail, name || null],
  );
  const userId = String((rows[0] as Row).id);
  const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  const code = String(Math.floor(100000 + (random % 900000)));
  await db.query(
    "INSERT INTO otp_tokens (user_id, hashed_code, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
    [userId, await hash(code)],
  );
  if (apiKey && from) {
    await sendOtp(apiKey, from, normalizedEmail, code);
    return c.json({ ok: true });
  }
  console.log('Development OTP generated', { email: normalizedEmail, code });
  return c.json({ ok: true, devCode: code });
});

authRouter.post('/auth/verify-otp', zValidator('json', verifySchema), async (c) => {
  const db = c.get('db') as Db | undefined;
  const secret =
    c.env.JWT_SECRET ??
    (c.env.ENVIRONMENT === 'development' ? 'local-development-only-jwt-secret' : undefined);
  if (!db || !secret) throw serviceUnavailable('Authentication is not configured');
  const { email, code } = c.req.valid('json');
  const rows = await db.query(
    'SELECT u.id, u.email, u.name, o.id AS otp_id, o.hashed_code FROM users u JOIN otp_tokens o ON o.user_id = u.id WHERE lower(u.email) = lower($1) AND o.expires_at > now() AND o.attempts < 5 ORDER BY o.created_at DESC LIMIT 1',
    [email],
  );
  const row = rows[0] as
    | (Row & {
        id: string;
        email: string;
        name: string | null;
        otp_id: string;
        hashed_code: string;
      })
    | undefined;
  if (!row || (await hash(code)) !== row.hashed_code) {
    if (row)
      await db.query('UPDATE otp_tokens SET attempts = attempts + 1 WHERE id = $1', [row.otp_id]);
    return c.json(
      { error: { code: 'INVALID_OTP', message: 'That code is invalid or expired' } },
      400,
    );
  }
  const accessToken = await token(row.id, secret);
  await db.query(
    "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [row.id, await hash(accessToken)],
  );
  await db.query('DELETE FROM otp_tokens WHERE user_id = $1', [row.id]);
  return c.json({ accessToken, user: { id: row.id, email: row.email, name: row.name } });
});
