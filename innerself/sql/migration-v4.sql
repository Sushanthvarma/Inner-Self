-- ============================================================
-- INNER SELF — SQL Migration V4 (Glacier Document)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. health_metrics: UNIQUE constraint + source_type
ALTER TABLE health_metrics ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'document';
DO $$ BEGIN
  ALTER TABLE health_metrics ADD CONSTRAINT unique_metric_per_date UNIQUE (metric_name, measured_at);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 2. weekly_reports: ensure columns exist
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS week_start_date DATE;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS week_end_date DATE;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS report_json JSONB;
ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 3. insights: add missing columns
ALTER TABLE insights ADD COLUMN IF NOT EXISTS confidence FLOAT;
ALTER TABLE insights ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
ALTER TABLE insights ADD COLUMN IF NOT EXISTS related_entry_ids UUID[] DEFAULT '{}';

-- 4. self_talk_daily: add missing columns
ALTER TABLE self_talk_daily ADD COLUMN IF NOT EXISTS total_entries INT DEFAULT 0;
ALTER TABLE self_talk_daily ADD COLUMN IF NOT EXISTS alert_triggered BOOLEAN DEFAULT false;

-- 5. life_events_timeline: add created_at if missing
ALTER TABLE life_events_timeline ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 6. user_persona_summary: add biography + timestamp columns
ALTER TABLE user_persona_summary ADD COLUMN IF NOT EXISTS biography_narrative TEXT;
ALTER TABLE user_persona_summary ADD COLUMN IF NOT EXISTS biography_generated_at TIMESTAMPTZ;
ALTER TABLE user_persona_summary ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ;

-- 7. CREATE cron_runs table
CREATE TABLE IF NOT EXISTS cron_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    result_summary JSONB,
    error TEXT,
    entries_processed INT DEFAULT 0
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_name ON cron_runs(job_name, started_at DESC);

-- 8. Clean existing bad data
-- Delete duplicates (keep newest)
DELETE FROM health_metrics a USING health_metrics b
WHERE a.metric_name = b.metric_name
  AND a.measured_at = b.measured_at
  AND a.created_at < b.created_at;

-- Delete unreliable brain-dump-sourced metrics
DELETE FROM health_metrics WHERE source_doc_id IS NULL AND source_entry_id IS NOT NULL;

-- Done
SELECT 'Migration V4 complete' AS status;
