
-- ============================================================
-- DEDUPLICATION MIGRATION
-- Run this to prevent duplicate events and people
-- ============================================================

-- 1. Add Unique Constraint to Life Events
-- Prevents same event title on same date from being inserted twice
ALTER TABLE life_events_timeline
ADD CONSTRAINT unique_event_date_title UNIQUE (event_date, title);

-- 2. Add Unique Constraint to People Map (if not already there)
-- (The name column should already be UNIQUE from previous migration, but reinforcing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'people_map_name_key'
    ) THEN
        ALTER TABLE people_map ADD CONSTRAINT people_map_name_key UNIQUE (name);
    END IF;
END $$;

-- 3. Cleanup existing duplicates (Optional but recommended)
-- This is complex to do safely in SQL without knowing specific IDs.
-- For now, we just enforce future uniqueness. 
-- User can delete duplicates manually or clear table if needed.
