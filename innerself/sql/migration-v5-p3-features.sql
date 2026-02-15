-- ============================================================
-- INNER SELF — SQL Migration V5: P3 Feature Tables
-- Run this in Supabase SQL Editor AFTER migration-v4
-- ============================================================

-- 1. DREAMS table
CREATE TABLE IF NOT EXISTS dreams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID,
    dream_text TEXT NOT NULL,
    dream_type TEXT DEFAULT 'normal' CHECK (dream_type IN ('normal', 'nightmare', 'recurring', 'lucid')),
    symbols JSONB DEFAULT '[]',
    emotions TEXT[] DEFAULT '{}',
    themes TEXT[] DEFAULT '{}',
    waking_connections TEXT,
    significance INT DEFAULT 5 CHECK (significance BETWEEN 1 AND 10),
    dream_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dreams_entry_id ON dreams(entry_id);
CREATE INDEX IF NOT EXISTS idx_dreams_date ON dreams(dream_date DESC);

-- 2. COURAGE_LOG table
CREATE TABLE IF NOT EXISTS courage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID,
    description TEXT NOT NULL,
    courage_type TEXT DEFAULT 'boundary' CHECK (courage_type IN ('boundary', 'vulnerability', 'risk', 'confrontation', 'honesty', 'change')),
    significance INT DEFAULT 5 CHECK (significance BETWEEN 1 AND 10),
    people_involved TEXT[] DEFAULT '{}',
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courage_entry_id ON courage_log(entry_id);

-- 3. LETTERS_TO_FUTURE table
CREATE TABLE IF NOT EXISTS letters_to_future (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_text TEXT NOT NULL,
    written_at TIMESTAMPTZ DEFAULT NOW(),
    unlock_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    mood_when_written INT CHECK (mood_when_written BETWEEN 1 AND 10),
    context_summary TEXT,
    tags TEXT[] DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_letters_unlock ON letters_to_future(unlock_at);

-- Done
SELECT 'Migration V5 (P3 Features) complete' AS status;
