-- ============================================================
-- MIGRATION v3.1 PATCHES (SAFE RUN)
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add missing columns to 'self_talk_daily'
ALTER TABLE IF EXISTS self_talk_daily 
ADD COLUMN IF NOT EXISTS total_entries INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS alert_triggered BOOLEAN DEFAULT FALSE;

-- 2. Add missing columns to 'weekly_reports'
ALTER TABLE IF EXISTS weekly_reports 
ADD COLUMN IF NOT EXISTS week_start_date DATE,
ADD COLUMN IF NOT EXISTS week_end_date DATE,
ADD COLUMN IF NOT EXISTS report_json JSONB,
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 3. Add missing columns to 'user_persona_summary'
ALTER TABLE IF EXISTS user_persona_summary 
ADD COLUMN IF NOT EXISTS biography_narrative TEXT,
ADD COLUMN IF NOT EXISTS biography_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- 4. Add missing columns to 'insights'
ALTER TABLE IF EXISTS insights 
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS related_entry_ids UUID[];

-- 5. Create 'uploaded_documents' table if not exists
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT,
  processed BOOLEAN DEFAULT FALSE,
  summary TEXT,
  entry_ids UUID[]
);

-- 6. Create 'health_metrics' table if not exists
CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric_name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  status TEXT,
  measured_at DATE DEFAULT NOW(),
  source_doc_id UUID REFERENCES uploaded_documents(id),
  source_entry_id UUID REFERENCES raw_entries(id),
  notes TEXT
);

-- 7. Add RLS Policies (Safe)
-- Drop existing policies first to avoid conflict errors
DROP POLICY IF EXISTS "Enable read/write for all" ON uploaded_documents;
DROP POLICY IF EXISTS "Enable read/write for all" ON health_metrics;

ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read/write for all" ON uploaded_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable read/write for all" ON health_metrics FOR ALL USING (true) WITH CHECK (true);
