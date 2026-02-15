-- ============================================================
-- INNER SELF — Fix wrongly-dated timeline events
-- Step 1: Allow NULL dates (remove NOT NULL constraint)
-- Step 2: Fix known dates
-- Run in Supabase SQL Editor
-- ============================================================

-- Allow NULL event_date (so historical events without known dates don't get fake dates)
ALTER TABLE life_events_timeline ALTER COLUMN event_date DROP NOT NULL;

-- Fix known career events
UPDATE life_events_timeline SET event_date = '2024-11-01' WHERE title ILIKE '%Wells Fargo%';
UPDATE life_events_timeline SET event_date = '2022-01-01' WHERE title ILIKE '%State Street%';
UPDATE life_events_timeline SET event_date = '2015-01-01' WHERE title ILIKE '%Manager%Business Analytics%HSBC%';
UPDATE life_events_timeline SET event_date = '2013-01-01' WHERE title ILIKE '%Assistant Manager%HSBC%';

-- Null out remaining events wrongly stamped Feb 14, 2026
UPDATE life_events_timeline 
SET event_date = NULL 
WHERE event_date = '2026-02-14' 
  AND title NOT ILIKE '%medical checkup%';

-- Verify
SELECT id, event_date, title, significance 
FROM life_events_timeline 
ORDER BY event_date ASC NULLS LAST;

SELECT 'Timeline dates fixed' AS status;
