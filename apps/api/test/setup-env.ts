// E2E tests never talk to a real Supabase project: tokens are signed by a local
// test key, and the issuer must match this URL. Overrides any value in .env.
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
// Tests always run with production-like auth, whatever the local .env says.
process.env.ADMIN_MFA_REQUIRED = 'true';
