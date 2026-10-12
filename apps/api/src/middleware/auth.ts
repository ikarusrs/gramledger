import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../config';
import type { Db } from '../lib/db';
import { serviceUnavailable } from '../lib/errors';

async function hash(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const db = c.get('db') as Db | undefined;
  const header = c.req.header('authorization');
  if (!db || !header?.startsWith('Bearer ')) throw serviceUnavailable('Sign in is required');
  const rows = await db.query(
    'SELECT user_id FROM sessions WHERE token_hash = $1 AND revoked = FALSE AND expires_at > now() LIMIT 1',
    [await hash(header.slice(7).trim())],
  );
  if (rows.length === 0) throw serviceUnavailable('Sign in is required');
  c.set('userId', String(rows[0]?.user_id));
  await next();
};
