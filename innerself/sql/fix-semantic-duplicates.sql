-- ============================================================
-- INNER SELF — Fix Semantic Duplicate Life Events (Round 2)
-- These have different titles but describe the same life event.
-- Run each block separately in Supabase SQL Editor.
-- ============================================================

-- 1. BSc duplicates: Keep "Completed Bachelor of Science in Computer Science" (sig 9), remove the other
DELETE FROM life_events_timeline
WHERE LOWER(title) = 'bachelor of science - computer science';

-- 2. MSc duplicates: Keep "Completed Master of Science in Data Science & Analytics" (sig 9), remove the other
DELETE FROM life_events_timeline
WHERE LOWER(title) LIKE 'completion of master of science%';

-- 3. HSBC Customer Service: Keep role description, remove "Started career at HSBC" (has wrong date 2015)
DELETE FROM life_events_timeline
WHERE LOWER(title) LIKE 'started career at hsbc%';

-- 4. HSBC Assistant Manager: Keep role description, remove "Started role as Assistant Manager"
DELETE FROM life_events_timeline
WHERE LOWER(title) LIKE 'started role as assistant manager at hsbc%';

-- 5. HSBC Manager: Keep role description, remove "Started role as Manager at HSBC"
DELETE FROM life_events_timeline
WHERE LOWER(title) LIKE 'started role as manager at hsbc%';

-- 6. State Street: Keep detailed title, remove "Started role as Business Analyst at State Street"
DELETE FROM life_events_timeline
WHERE LOWER(title) LIKE 'started role as business analyst at state street%';

-- 7. Wells Fargo joining: Keep "Started role as Senior Business Execution Consultant", remove generic "Career transition"
DELETE FROM life_events_timeline
WHERE LOWER(title) = 'career transition to wells fargo';

-- 8. Health checkups: Keep "Comprehensive Health Screening" (more specific), remove "Medical checkup and health monitoring"
DELETE FROM life_events_timeline
WHERE LOWER(title) = 'medical checkup and health monitoring';

-- 9. Life story: Keep "Life story documentation project" (has date), remove "Request for Complete Life Story Recreation"
DELETE FROM life_events_timeline
WHERE LOWER(title) = 'request for complete life story recreation';

-- Verify: Should be ~15 unique events now
SELECT COUNT(*) as total_events FROM life_events_timeline;

-- Show final timeline
SELECT 
    title,
    event_date,
    category,
    significance
FROM life_events_timeline
ORDER BY event_date ASC NULLS LAST;
