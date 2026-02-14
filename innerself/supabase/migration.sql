-- ============================================================
-- INNER SELF — Production Database Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. RAW ENTRIES (Immutable Source of Truth)
-- NEVER modify after creation. Append-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS raw_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    raw_text TEXT NOT NULL,
    audio_url TEXT,
    audio_duration_sec INT,
    source TEXT NOT NULL CHECK (source IN ('text', 'voice', 'image')) DEFAULT 'text',
    input_metadata JSONB DEFAULT '{}',
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_raw_entries_created_at ON raw_entries(created_at DESC);
CREATE INDEX idx_raw_entries_source ON raw_entries(source);
CREATE INDEX idx_raw_entries_deleted_at ON raw_entries(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- 2. EXTRACTED ENTITIES (AI Analysis Per Entry)
-- ============================================================
CREATE TABLE IF NOT EXISTS extracted_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES raw_entries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('emotion', 'task', 'reflection', 'goal', 'memory', 'idea', 'gratitude', 'vent')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
    surface_emotion TEXT,
    deeper_emotion TEXT,
    core_need TEXT,
    triggers TEXT[] DEFAULT '{}',
    defense_mechanism TEXT,
    self_talk_tone TEXT CHECK (self_talk_tone IN ('critical', 'neutral', 'compassionate')),
    energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
    cognitive_pattern TEXT,
    beliefs_revealed TEXT[] DEFAULT '{}',
    avoidance_signal TEXT,
    growth_edge TEXT,
    identity_persona TEXT,
    body_signals TEXT[] DEFAULT '{}',
    is_task BOOLEAN DEFAULT FALSE,
    task_status TEXT CHECK (task_status IN ('pending', 'done', 'cancelled')),
    task_due_date DATE,
    people_mentioned JSONB DEFAULT '[]',
    ai_response TEXT,
    ai_persona_used TEXT,
    follow_up_question TEXT
);

CREATE INDEX idx_extracted_entities_entry_id ON extracted_entities(entry_id);
CREATE INDEX idx_extracted_entities_category ON extracted_entities(category);
CREATE INDEX idx_extracted_entities_is_task ON extracted_entities(is_task) WHERE is_task = TRUE;
CREATE INDEX idx_extracted_entities_created_at ON extracted_entities(created_at DESC);
CREATE INDEX idx_extracted_entities_mood ON extracted_entities(mood_score);
CREATE INDEX idx_extracted_entities_identity ON extracted_entities(identity_persona);

-- ============================================================
-- 3. EMBEDDINGS (Vector Search for RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES raw_entries(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    embedding vector(1536) NOT NULL,
    content_text TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_embeddings_entry_id ON embeddings(entry_id);

-- Create HNSW index for fast vector similarity search
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- 4. PEOPLE MAP
-- ============================================================
CREATE TABLE IF NOT EXISTS people_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    relationship TEXT,
    first_mentioned TIMESTAMPTZ DEFAULT NOW(),
    last_mentioned TIMESTAMPTZ DEFAULT NOW(),
    mention_count INT DEFAULT 1,
    sentiment_history JSONB DEFAULT '[]',
    sentiment_avg FLOAT DEFAULT 5.0,
    notes TEXT,
    tags TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_people_map_name ON people_map(name);
CREATE INDEX idx_people_map_last_mentioned ON people_map(last_mentioned DESC);

-- ============================================================
-- 5. LIFE EVENTS TIMELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS life_events_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title TEXT NOT NULL,
    description TEXT,
    significance INT DEFAULT 5 CHECK (significance BETWEEN 1 AND 10),
    chapter TEXT,
    category TEXT CHECK (category IN ('career', 'family', 'health', 'relationship', 'personal', 'loss', 'achievement')),
    emotions TEXT[] DEFAULT '{}',
    people_involved TEXT[] DEFAULT '{}',
    source_entry_ids UUID[] DEFAULT '{}'
);

CREATE INDEX idx_life_events_date ON life_events_timeline(event_date DESC);
CREATE INDEX idx_life_events_category ON life_events_timeline(category);

-- ============================================================
-- 6. USER PERSONA SUMMARY (Single Row, Rewritten Weekly)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_persona_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    life_chapter_title TEXT,
    life_chapter_narrative TEXT,
    baseline_mood TEXT,
    baseline_energy FLOAT DEFAULT 5.0,
    active_goals JSONB DEFAULT '[]',
    dominant_personas TEXT[] DEFAULT '{}',
    neglected_personas TEXT[] DEFAULT '{}',
    key_relationships JSONB DEFAULT '{}',
    core_beliefs_operating TEXT[] DEFAULT '{}',
    biggest_growth_edge TEXT,
    currently_avoiding TEXT,
    self_talk_ratio JSONB DEFAULT '{"positive": 33, "neutral": 34, "critical": 33}',
    recurring_patterns TEXT[] DEFAULT '{}',
    companion_preference TEXT,
    full_psychological_profile TEXT
);

-- ============================================================
-- 7. CONVERSATIONS (Chat History)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    context_entry_ids UUID[] DEFAULT '{}',
    persona_used TEXT
);

CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);

-- ============================================================
-- 8. INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    insight_text TEXT NOT NULL,
    type TEXT DEFAULT 'auto_extracted',
    source_entry_id UUID REFERENCES raw_entries(id) ON DELETE SET NULL
);

CREATE INDEX idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX idx_insights_type ON insights(type);

-- ============================================================
-- 9. WEEKLY REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    mood_avg FLOAT,
    energy_avg FLOAT,
    wins TEXT[] DEFAULT '{}',
    struggles TEXT[] DEFAULT '{}',
    honest_truth TEXT,
    growth_observed TEXT,
    recommendation TEXT,
    patterns_noticed TEXT[] DEFAULT '{}',
    entry_count INT DEFAULT 0
);

CREATE INDEX idx_weekly_reports_week ON weekly_reports(week_start DESC);

-- ============================================================
-- 10. VOID TRACKER
-- ============================================================
CREATE TABLE IF NOT EXISTS void_tracker (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_name TEXT NOT NULL,
    last_mentioned TIMESTAMPTZ,
    peak_frequency INT DEFAULT 0,
    current_frequency INT DEFAULT 0,
    decay_percentage FLOAT DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fading', 'void')),
    surfaced_at TIMESTAMPTZ
);

CREATE INDEX idx_void_tracker_status ON void_tracker(status);

-- ============================================================
-- 11. TEMPORAL MARKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS temporal_markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_title TEXT NOT NULL,
    event_date DATE NOT NULL,
    recurrence TEXT DEFAULT 'annual' CHECK (recurrence IN ('annual', 'one-time')),
    reminder_message TEXT,
    last_checked TIMESTAMPTZ
);

CREATE INDEX idx_temporal_markers_date ON temporal_markers(event_date);

-- ============================================================
-- 12. BELIEF SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS belief_system (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    belief_text TEXT NOT NULL,
    domain TEXT,
    first_surfaced TIMESTAMPTZ DEFAULT NOW(),
    last_reinforced TIMESTAMPTZ DEFAULT NOW(),
    reinforcement_count INT DEFAULT 1,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'questioned', 'evolved'))
);

CREATE INDEX idx_belief_system_status ON belief_system(status);

-- ============================================================
-- 13. COURAGE LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS courage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_description TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    context TEXT,
    source_entry_id UUID REFERENCES raw_entries(id) ON DELETE SET NULL
);

-- ============================================================
-- 14. SELF TALK DAILY
-- ============================================================
CREATE TABLE IF NOT EXISTS self_talk_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    positive_pct FLOAT DEFAULT 0,
    neutral_pct FLOAT DEFAULT 0,
    critical_pct FLOAT DEFAULT 0,
    entry_count INT DEFAULT 0
);

CREATE UNIQUE INDEX idx_self_talk_daily_date ON self_talk_daily(date);

-- ============================================================
-- 15. DEEPENING QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS deepening_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    category TEXT,
    week_range TEXT,
    asked_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    answer TEXT,
    skipped BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 16. ONBOARDING ANSWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_answers_number ON onboarding_answers(question_number);

-- ============================================================
-- 17. LETTERS TO FUTURE
-- ============================================================
CREATE TABLE IF NOT EXISTS letters_to_future (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    content TEXT NOT NULL,
    unlock_date DATE NOT NULL,
    context_when_written TEXT,
    unlocked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_letters_unlock ON letters_to_future(unlock_date) WHERE unlocked = FALSE;

-- ============================================================
-- 18. DREAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS dreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    raw_text TEXT NOT NULL,
    symbols TEXT[] DEFAULT '{}',
    waking_connections TEXT,
    source_entry_id UUID REFERENCES raw_entries(id) ON DELETE SET NULL
);

-- ============================================================
-- RPC FUNCTION: match_embeddings (Vector Similarity Search)
-- Used by RAG pipeline for semantic search
-- ============================================================
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10,
    filter_category TEXT DEFAULT NULL,
    filter_person TEXT DEFAULT NULL,
    filter_start_date TEXT DEFAULT NULL,
    filter_end_date TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    entry_id UUID,
    content_text TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.entry_id,
        e.content_text,
        e.metadata,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM embeddings e
    WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
        AND (filter_category IS NULL OR e.metadata->>'category' = filter_category)
        AND (filter_person IS NULL OR e.metadata->'people' ? filter_person)
        AND (filter_start_date IS NULL OR (e.metadata->>'date')::date >= filter_start_date::date)
        AND (filter_end_date IS NULL OR (e.metadata->>'date')::date <= filter_end_date::date)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ============================================================
-- DISABLE RLS (Single-user system, no auth needed)
-- ============================================================
ALTER TABLE raw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_persona_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE void_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE belief_system ENABLE ROW LEVEL SECURITY;
ALTER TABLE courage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_talk_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE deepening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters_to_future ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;

-- Permissive policies (single user, allow all operations)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'raw_entries', 'extracted_entities', 'embeddings', 'people_map',
            'life_events_timeline', 'user_persona_summary', 'conversations',
            'insights', 'weekly_reports', 'void_tracker', 'temporal_markers',
            'belief_system', 'courage_log', 'self_talk_daily', 'deepening_questions',
            'onboarding_answers', 'letters_to_future', 'dreams'
        ])
    LOOP
        EXECUTE format('CREATE POLICY "Allow all for %1$s" ON %1$s FOR ALL USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END;
$$;

-- ============================================================
-- GRANT permissions to service role and anon
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================
-- DONE! All 18 tables + vector search + RLS policies created.
-- ============================================================
