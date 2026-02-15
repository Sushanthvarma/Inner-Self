-- ============================================================
-- INNER SELF — Fix Duplicate Life Events
-- Run this in Supabase SQL Editor to clean up duplicate timeline entries.
-- Keeps the entry with the HIGHEST significance score for each group.
-- Run each step separately (highlight + Run) to review before deleting.
-- ============================================================

-- Step 1: Preview duplicates (run this first to see what will be removed)
SELECT 
    LOWER(TRIM(title)) as normalized_title,
    COUNT(*) as duplicate_count,
    array_agg(id) as ids,
    array_agg(significance) as significance_scores,
    array_agg(event_date::text) as dates
FROM life_events_timeline
GROUP BY LOWER(TRIM(title))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Delete duplicates — keep the one with highest significance (or first created)
WITH ranked AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title))
            ORDER BY significance DESC NULLS LAST, created_at ASC
        ) as rn
    FROM life_events_timeline
)
DELETE FROM life_events_timeline
WHERE id IN (
    SELECT id FROM ranked WHERE rn > 1
);

-- Step 3: Also fix near-duplicates (titles that contain each other)
-- E.g., "Business Analyst at State Street" vs 
--        "Business Analyst - Service Availability Management at State Street"
-- Keep the longer (more descriptive) one.
WITH pairs AS (
    SELECT 
        a.id as short_id,
        a.title as short_title,
        b.title as long_title
    FROM life_events_timeline a
    JOIN life_events_timeline b ON a.id != b.id
    WHERE LOWER(b.title) LIKE '%' || LOWER(LEFT(a.title, 40)) || '%'
      AND LENGTH(b.title) > LENGTH(a.title)
)
DELETE FROM life_events_timeline
WHERE id IN (SELECT short_id FROM pairs);

-- Step 4: Normalize category casing (fix mixed case like "Career" vs "career")
UPDATE life_events_timeline
SET category = LOWER(TRIM(category))
WHERE category IS NOT NULL AND category != LOWER(TRIM(category));

-- Step 5: Verify results
SELECT 
    category,
    COUNT(*) as count
FROM life_events_timeline
GROUP BY category
ORDER BY count DESC;

SELECT COUNT(*) as total_events FROM life_events_timeline;
