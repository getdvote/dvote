/** Self sign-up rules (decided 2026-10-21; trial 14 days since 2026-10-23). */
export const TRIAL = {
  /** Every merchant-admin feature, free, for this long after sign-up. */
  trialDays: 14,
  /** An unpaid trial shop is deleted for good this long after sign-up. */
  deleteAfterDays: 30,
  /** How often the API locks ended trials and deletes overdue ones. */
  checkEveryMs: 15 * 60 * 1000,
};
