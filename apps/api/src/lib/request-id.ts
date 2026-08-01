/**
 * Returns a short, URL-safe request id (e.g. `a1b2c3d4`). Uses the first 8 hex
 * chars of a UUID — adequate for correlation in logs; cryptographically
 * collision-safe for realistic request volumes. Uses the Web Crypto API so it
 * runs on both the Workers runtime and Node (vitest).
 */
export function createRequestId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 8);
}
