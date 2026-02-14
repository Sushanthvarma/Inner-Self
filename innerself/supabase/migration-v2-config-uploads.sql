-- ============================================================
-- INNER SELF — Migration: Add app_config and uploaded_documents
-- Run this in Supabase SQL Editor
-- ============================================================

-- Key-value config store for app state
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track uploaded documents
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  extracted_text TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  insights_generated JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
