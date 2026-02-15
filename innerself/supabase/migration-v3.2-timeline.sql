-- ============================================================
-- MIGRATION v3.2 TIMELINE ENHANCEMENTS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add 'created_at' to life_events_timeline
ALTER TABLE IF EXISTS life_events_timeline 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Backfill existing rows (optional, defaults to now)
-- UPDATE life_events_timeline SET created_at = NOW() WHERE created_at IS NULL;
