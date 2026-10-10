-- Opening hours per weekday, with split shifts, and a short "temporarily closed" pause.
--   weekly_hours: JSON array of {"day": 0-6 (0 = Sunday), "opensAt": "HH:MM", "closesAt": "HH:MM"},
--     several per day for split shifts; a day with no entry is closed that day; NULL = hours not set.
--     closesAt earlier than opensAt = open past midnight. Validated by the API.
--     opens_at / closes_at stay for older app builds: the API keeps them equal to the hours when
--     every day has the same single slot, NULL otherwise.
--   paused_until: temporarily closed until then (power cut, prayer time, stock-taking...). Counts
--     while it is in the future, so it ends by itself; nothing runs on a schedule.
-- Idempotent so it is safe on databases built from the updated database/dvote_schema.sql.

ALTER TABLE branches ADD COLUMN IF NOT EXISTS weekly_hours jsonb;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS paused_until timestamptz;

DO $$
BEGIN
    ALTER TABLE branches ADD CONSTRAINT branches_weekly_hours_ck
        CHECK (weekly_hours IS NULL OR jsonb_typeof(weekly_hours) = 'array');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Branches with the old "same hours every day" get them on all seven days.
UPDATE branches b
SET weekly_hours = (
    SELECT jsonb_agg(jsonb_build_object('day', d, 'opensAt', b.opens_at, 'closesAt', b.closes_at) ORDER BY d)
    FROM generate_series(0, 6) AS d
)
WHERE b.weekly_hours IS NULL AND b.opens_at IS NOT NULL AND b.closes_at IS NOT NULL;
