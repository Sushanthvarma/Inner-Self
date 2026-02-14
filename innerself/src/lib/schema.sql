-- ============================================================
-- INNER SELF — Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE TABLES
-- ============================================================

-- raw_entries: Immutable source of truth. NEVER modified after creation.
CREATE TABLE IF NOT EXISTS raw_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('text', 'voice')),
  input_metadata JSONB,
  deleted_at TIMESTAMPTZ
);

-- extracted_entities: AI analysis per entry (15+ psychological dimensions)
CREATE TABLE IF NOT EXISTS extracted_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID REFERENCES raw_entries(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  title TEXT,
  content TEXT,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  surface_emotion TEXT,
  deeper_emotion TEXT,
  core_need TEXT,
  triggers TEXT[],
  defense_mechanism TEXT,
  self_talk_tone TEXT CHECK (self_talk_tone IN ('critical', 'neutral', 'compassionate')),
  energy_level INT CHECK (energy_level BETWEEN 1 AND 10),
  cognitive_pattern TEXT,
  beliefs_revealed TEXT[],
  avoidance_signal TEXT,
  growth_edge TEXT,
  identity_persona TEXT,
  body_signals TEXT[],
  is_task BOOLEAN DEFAULT FALSE,
  task_status TEXT CHECK (task_status IN ('pending', 'done', 'cancelled')),
  task_due_date DATE,
  people_mentioned JSONB[],
  ai_response TEXT,
  ai_persona_used TEXT,
  follow_up_question TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- embeddings: Vector search for RAG
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID REFERENCES raw_entries(id) ON DELETE CASCADE NOT NULL,
  embedding vector(1536) NOT NULL,
  content_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- people_map: Relationship tracking
CREATE TABLE IF NOT EXISTS people_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  relationship TEXT,
  first_mentioned TIMESTAMPTZ NOT NULL,
  last_mentioned TIMESTAMPTZ NOT NULL,
  mention_count INT DEFAULT 1,
  sentiment_history JSONB[],
  sentiment_avg FLOAT,
  notes TEXT,
  tags TEXT[]
);

-- life_events_timeline: Significant life events
CREATE TABLE IF NOT EXISTS life_events_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  significance INT CHECK (significance BETWEEN 1 AND 10),
  chapter TEXT,
  category TEXT,
  emotions TEXT[],
  people_involved TEXT[],
  source_entry_ids UUID[]
);

-- user_persona_summary: God-view of who the user is (single row, rewritten weekly)
CREATE TABLE IF NOT EXISTS user_persona_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  life_chapter_title TEXT,
  life_chapter_narrative TEXT,
  baseline_mood TEXT,
  baseline_energy FLOAT,
  active_goals JSONB,
  dominant_personas TEXT[],
  neglected_personas TEXT[],
  key_relationships JSONB,
  core_beliefs_operating TEXT[],
  biggest_growth_edge TEXT,
  currently_avoiding TEXT,
  self_talk_ratio JSONB,
  recurring_patterns TEXT[],
  companion_preference TEXT,
  full_psychological_profile TEXT
);

-- ============================================================
-- SUPPORTING TABLES
-- ============================================================

-- conversations: Chat history with AI mentor
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_entry_ids UUID[],
  persona_used TEXT
);

-- insights: Individual AI observations
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  insight_text TEXT NOT NULL,
  type TEXT,
  source_entry_id UUID REFERENCES raw_entries(id)
);

-- weekly_reports: Auto-generated weekly reviews
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_start DATE,
  week_end DATE,
  mood_avg FLOAT,
  energy_avg FLOAT,
  wins TEXT[],
  struggles TEXT[],
  honest_truth TEXT,
  growth_observed TEXT,
  recommendation TEXT,
  patterns_noticed TEXT[],
  entry_count INT
);

-- void_tracker: Topics that disappeared
CREATE TABLE IF NOT EXISTS void_tracker (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag_name TEXT NOT NULL,
  last_mentioned TIMESTAMPTZ,
  peak_frequency INT,
  current_frequency INT,
  decay_percentage FLOAT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fading', 'void')),
  surfaced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- temporal_markers: Anniversary dates and seasonal patterns
CREATE TABLE IF NOT EXISTS temporal_markers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_title TEXT NOT NULL,
  event_date DATE NOT NULL,
  recurrence TEXT DEFAULT 'annual' CHECK (recurrence IN ('annual', 'one-time')),
  reminder_message TEXT,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- belief_system: Extracted beliefs
CREATE TABLE IF NOT EXISTS belief_system (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  belief_text TEXT NOT NULL,
  domain TEXT,
  first_surfaced TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reinforced TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reinforcement_count INT DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'questioned', 'evolved'))
);

-- dreams: Dream logs
CREATE TABLE IF NOT EXISTS dreams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_text TEXT NOT NULL,
  symbols TEXT[],
  waking_connections TEXT,
  source_entry_id UUID REFERENCES raw_entries(id)
);

-- courage_log: Brave moments
CREATE TABLE IF NOT EXISTS courage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_description TEXT NOT NULL,
  date DATE NOT NULL,
  context TEXT,
  source_entry_id UUID REFERENCES raw_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- self_talk_daily: Daily rolling scores
CREATE TABLE IF NOT EXISTS self_talk_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  positive_pct FLOAT,
  neutral_pct FLOAT,
  critical_pct FLOAT,
  entry_count INT DEFAULT 0
);

-- deepening_questions: Questions asked and answered
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

-- onboarding_answers: Day 1 answers preserved separately
CREATE TABLE IF NOT EXISTS onboarding_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- letters_to_future: Time-locked letters
CREATE TABLE IF NOT EXISTS letters_to_future (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content TEXT NOT NULL,
  unlock_date DATE NOT NULL,
  context_when_written TEXT,
  unlocked BOOLEAN DEFAULT FALSE
);

-- app_config: Key-value store for app state (onboarding status, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- uploaded_documents: Track user-uploaded files for AI analysis
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  extracted_text TEXT,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  insights_generated JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS (for pgvector search)
-- ============================================================

-- Match embeddings function for semantic search
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL,
  filter_person text DEFAULT NULL,
  filter_start_date text DEFAULT NULL,
  filter_end_date text DEFAULT NULL
)
RETURNS TABLE (
  entry_id uuid,
  content_text text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.entry_id,
    e.content_text,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.metadata
  FROM embeddings e
  WHERE 1 - (e.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR e.metadata->>'category' = filter_category)
    AND (filter_person IS NULL OR e.metadata->'people' ? filter_person)
    AND (filter_start_date IS NULL OR e.metadata->>'date' >= filter_start_date)
    AND (filter_end_date IS NULL OR e.metadata->>'date' <= filter_end_date)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_raw_entries_created_at ON raw_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_entries_source ON raw_entries(source);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_entry_id ON extracted_entities(entry_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_category ON extracted_entities(category);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_is_task ON extracted_entities(is_task) WHERE is_task = TRUE;
CREATE INDEX IF NOT EXISTS idx_extracted_entities_mood ON extracted_entities(mood_score);
CREATE INDEX IF NOT EXISTS idx_people_map_name ON people_map(name);
CREATE INDEX IF NOT EXISTS idx_life_events_date ON life_events_timeline(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_source ON insights(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_self_talk_date ON self_talk_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_deepening_asked ON deepening_questions(asked_at);

-- ============================================================
-- SEED: Insert onboarding questions into deepening_questions
-- ============================================================

INSERT INTO deepening_questions (question_text, category, week_range) VALUES
  ('How''s your relationship with your health — sleep, exercise, energy?', 'health', 'week_1_2'),
  ('What''s your relationship with money? Does it stress you or empower you?', 'finance', 'week_1_2'),
  ('What does spirituality mean to you, if anything?', 'spirituality', 'week_1_2'),
  ('What did you dream of becoming as a child?', 'identity', 'week_1_2'),
  ('Who has had the biggest influence on who you are today?', 'relationships', 'week_1_2'),
  ('What are your routines — the non-negotiable things you do daily?', 'habits', 'week_1_2'),
  ('How do you relax? Like truly relax, not just numb out?', 'wellbeing', 'week_1_2'),
  ('How do you feel about your body?', 'body', 'week_1_2'),
  ('Do you have any creative outlets — writing, music, art, anything?', 'creativity', 'week_1_2'),
  ('What''s the one thing you wish someone understood about you?', 'identity', 'week_1_2'),
  ('What''s the hardest experience you''ve ever gone through?', 'resilience', 'week_2_4'),
  ('What do you think about during your commute?', 'inner_world', 'week_2_4'),
  ('When was the last time you cried, and why?', 'emotion', 'week_2_4'),
  ('What part of yourself do you hide from others?', 'shadow', 'week_2_4'),
  ('How do you think people see you vs. how you actually feel inside?', 'identity', 'week_2_4'),
  ('What belief have you changed your mind about?', 'growth', 'week_2_4'),
  ('Is there someone you need to forgive — including yourself?', 'forgiveness', 'week_2_4'),
  ('What role do you play in your family? Is it the role you want?', 'family', 'week_2_4'),
  ('When was the last time you felt truly lonely?', 'loneliness', 'week_2_4'),
  ('What''s the difference between who you are and who you pretend to be?', 'authenticity', 'week_2_4'),
  ('If you had absolutely no constraints, what would you do with your life?', 'dreams', 'month_1_plus'),
  ('Is there something important that remains unsaid to someone?', 'relationships', 'month_1_plus'),
  ('What patterns keep repeating in your life?', 'patterns', 'month_1_plus'),
  ('When do you feel most authentically yourself?', 'authenticity', 'month_1_plus'),
  ('What dream have you given up on that still calls to you?', 'dreams', 'month_1_plus'),
  ('What would your 80-year-old self tell you right now?', 'wisdom', 'month_1_plus'),
  ('How do you define success — really, not what sounds good?', 'values', 'month_1_plus'),
  ('What would your life look like if you stopped caring what others think?', 'freedom', 'month_1_plus'),
  ('What''s the bravest thing you''ve ever done?', 'courage', 'month_1_plus'),
  ('If Inner Self could understand one thing about you perfectly, what would it be?', 'identity', 'month_1_plus')
ON CONFLICT DO NOTHING;
