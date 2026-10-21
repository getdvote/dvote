-- Join verification moved to Supabase Auth (decided 2026-10-17, option A): the web join page signs
-- the customer in with "Continue with Google" or Supabase's email one-time code, and the API trusts
-- the verified email in that token. Our own email-code table (16_wallet_join) is not needed; it
-- never held data.
DROP TABLE join_requests;
