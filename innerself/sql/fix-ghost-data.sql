-- ============================================================
-- INNER SELF — One-time ghost data cleanup
-- Run in Supabase SQL Editor
-- After this, the code-level validators will prevent future issues.
-- ============================================================

-- 1. Delete hallucinated "Google" events (prompt leakage)
DELETE FROM life_events_timeline WHERE title ILIKE '%Google%';

-- 2. Null out ALL dates before 1985 (user born ~1993, nothing valid before 1985)
UPDATE life_events_timeline
SET event_date = NULL
WHERE event_date IS NOT NULL AND event_date < '1985-01-01';

-- 3. Null out future dates beyond next year
UPDATE life_events_timeline
SET event_date = NULL
WHERE event_date > (CURRENT_DATE + INTERVAL '1 year');

-- 4. Clean "Google" from biography
UPDATE user_persona_summary
SET biography_narrative = REPLACE(biography_narrative, 'Google', '[removed]'),
    biography_generated_at = NULL
WHERE biography_narrative ILIKE '%Google%';

-- 5. Verify — should show no 1978, no Google, no future dates
SELECT id, event_date, title, significance, category
FROM life_events_timeline
ORDER BY event_date ASC NULLS LAST;

SELECT 'Ghost data cleanup complete — code validators will prevent future issues' AS status;
