
-- ============================================================
-- MISSING TABLES MIGRATION
-- Run this in Supabase SQL Editor to fix "Table not found" errors
-- ============================================================

-- 1. Life Events Timeline (Missing!)
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

CREATE INDEX IF NOT EXISTS idx_life_events_date ON life_events_timeline(event_date DESC);

-- 2. People Map
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

CREATE INDEX IF NOT EXISTS idx_people_map_name ON people_map(name);

-- 3. User Persona Summary
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

-- 4. Insights
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  insight_text TEXT NOT NULL,
  type TEXT,
  source_entry_id UUID -- Removed FK constraint to avoid locking issues with missing/deleted entries
);

CREATE INDEX IF NOT EXISTS idx_insights_source ON insights(source_entry_id);

-- 5. Weekly Reports
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

-- 6. Enable RLS (Security)
ALTER TABLE life_events_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE people_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_persona_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Allow access (Simplified for single-user app)
CREATE POLICY "Allow all for life_events_timeline" ON life_events_timeline FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for people_map" ON people_map FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for user_persona_summary" ON user_persona_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for insights" ON insights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for weekly_reports" ON weekly_reports FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
