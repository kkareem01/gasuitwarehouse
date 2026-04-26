/**
 * libSQL/Turso client singleton.
 * - Production (Vercel): TURSO_DATABASE_URL=libsql://... + TURSO_AUTH_TOKEN
 * - Local dev: TURSO_DATABASE_URL=file:local.db (no auth token needed)
 *
 * Same SQL works in both environments.
 */

import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TURSO_DATABASE_URL is not set. Use "file:local.db" for local dev or "libsql://...turso.io" for production.'
    );
  }

  const authToken = process.env.TURSO_AUTH_TOKEN;
  client = createClient({
    url,
    ...(authToken ? { authToken } : {}),
  });
  return client;
}
