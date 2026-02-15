-- ============================================================
-- INNER SELF — Comprehensive Timeline Data Audit & Fix
-- Run in Supabase SQL Editor
-- Step 1: AUDIT (run SELECT queries first to see current state)
-- Step 2: FIX (run the UPDATE/DELETE statements)
-- ============================================================

-- ============ STEP 1: AUDIT ============

-- Show ALL timeline events, sorted by date
SELECT id, event_date, title, category, significance, 
       created_at,
       source_entry_ids
FROM life_events_timeline
ORDER BY event_date ASC NULLS LAST;

-- Find DUPLICATE events (same or very similar titles)
SELECT title, COUNT(*) as count, 
       array_agg(id) as ids,
       array_agg(event_date) as dates
FROM life_events_timeline
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Find events with NULL dates
SELECT id, title, category, significance, created_at
FROM life_events_timeline
WHERE event_date IS NULL;

-- ============ STEP 2: FIX DUPLICATES ============
-- Delete duplicates, keeping the one with the best date (non-null preferred, newest created_at as tiebreaker)
DELETE FROM life_events_timeline a
USING life_events_timeline b
WHERE a.title = b.title
  AND a.id != b.id
  AND (
    -- Keep the one with a non-null date
    (a.event_date IS NULL AND b.event_date IS NOT NULL)
    OR
    -- If both have dates (or both null), keep the newer one
    (a.event_date IS NOT DISTINCT FROM b.event_date AND a.created_at < b.created_at)
  );

-- ============ STEP 3: FIX KNOWN DATES ============
-- Based on resume data. Adjust these to match YOUR actual career dates.

-- Education
UPDATE life_events_timeline SET event_date = '2009-04-01'
WHERE title ILIKE '%Bachelor%Science%Computer%' OR title ILIKE '%Bachelor%Computer Science%';

UPDATE life_events_timeline SET event_date = '2022-04-01'
WHERE title ILIKE '%Master%Science%Data%' OR title ILIKE '%Master%Data Science%';

-- HSBC career progression
UPDATE life_events_timeline SET event_date = '2010-06-01'
WHERE title ILIKE '%Customer Service%Executive%HSBC%';

UPDATE life_events_timeline SET event_date = '2013-01-01'
WHERE title ILIKE '%Assistant Manager%HSBC%'
  OR title ILIKE '%Assistant Manager%Operations%Analytics%';

UPDATE life_events_timeline SET event_date = '2015-01-01'
WHERE title ILIKE '%Manager%Business Analytics%HSBC%';

-- AMO Superstar Award (HSBC era)
UPDATE life_events_timeline SET event_date = '2014-01-01'
WHERE title ILIKE '%AMO Superstar%';

-- State Street
UPDATE life_events_timeline SET event_date = '2022-01-01'
WHERE title ILIKE '%State Street%';

-- Wells Fargo
UPDATE life_events_timeline SET event_date = '2024-11-01'
WHERE title ILIKE '%Wells Fargo%';

-- Lloyds Technology Centre
UPDATE life_events_timeline SET event_date = '2023-10-01'
WHERE title ILIKE '%Lloyds%' OR title ILIKE '%Business Manager%Lloyds%';

-- ============ STEP 4: VERIFY ============

SELECT id, event_date, title, category, significance
FROM life_events_timeline
ORDER BY event_date ASC NULLS LAST;

SELECT 
  COUNT(*) as total_events,
  COUNT(event_date) as dated_events,
  COUNT(*) - COUNT(event_date) as undated_events,
  MIN(event_date) as earliest,
  MAX(event_date) as latest
FROM life_events_timeline;

SELECT 'Comprehensive timeline fix complete' AS status;
