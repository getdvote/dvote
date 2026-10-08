import 'dotenv/config';

// E2E tests write and delete rows (cleanup needs a superuser), so they only ever run against
// a local database: TEST_DATABASE_URL when set (DATABASE_URL may point at the cloud database).
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const dbHost = new URL(process.env.DATABASE_URL ?? 'postgresql://missing').hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost)) {
  throw new Error(
    `E2E tests refuse to run against ${dbHost}: set TEST_DATABASE_URL in apps/api/.env to the local database.`,
  );
}

// E2E tests never talk to a real Supabase project: tokens are signed by a local
// test key, and the issuer must match this URL. Overrides any value in .env.
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
// Tests always run with production-like auth, whatever the local .env says.
process.env.ADMIN_MFA_REQUIRED = 'true';
