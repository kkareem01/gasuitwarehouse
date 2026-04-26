/**
 * One-time DB schema setup. Run with:
 *   npm run migrate
 *
 * Re-running is safe — every statement is `IF NOT EXISTS`.
 */

import { migrate } from '../lib/migrate.mjs';

try {
  await migrate();
  console.log('OK: schema is up to date');
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
