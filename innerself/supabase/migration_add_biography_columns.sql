-- ============================================================
-- ADD BIOGRAPHY COLUMNS TO user_persona_summary
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE user_persona_summary 
ADD COLUMN IF NOT EXISTS biography_narrative TEXT,
ADD COLUMN IF NOT EXISTS biography_generated_at TIMESTAMPTZ;
