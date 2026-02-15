-- 1. Health Metrics Table
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

CREATE INDEX IF NOT EXISTS idx_health_metric_name ON health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_date ON health_metrics(measured_at DESC);


-- 2. Deepening Questions Table
CREATE TABLE IF NOT EXISTS deepening_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  question_text TEXT NOT NULL,
  category TEXT DEFAULT 'reflection',
  week_range TEXT,                    -- 'dynamic_ai' or specific week
  asked_at TIMESTAMPTZ,               -- When it was shown to user
  answered_at TIMESTAMPTZ,            -- When user answered
  answer TEXT,
  skipped BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_questions_asked ON deepening_questions(asked_at);
CREATE INDEX IF NOT EXISTS idx_questions_answered ON deepening_questions(answered_at);

-- Optional: Seed some initial questions?
INSERT INTO deepening_questions (question_text, category, week_range)
SELECT 'What is one thing you are grateful for today?', 'gratitude', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM deepening_questions WHERE question_text = 'What is one thing you are grateful for today?');

INSERT INTO deepening_questions (question_text, category, week_range)
SELECT 'What drained your energy today, and what gave you energy?', 'energy', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM deepening_questions WHERE question_text = 'What drained your energy today, and what gave you energy?');
