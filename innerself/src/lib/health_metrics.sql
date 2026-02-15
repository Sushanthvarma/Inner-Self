-- ============================================================
-- INNER SELF — Health Metrics Table
-- Run this in Supabase SQL Editor to enable Health Dashboard
-- ============================================================

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metric_name TEXT NOT NULL,          -- e.g. "weight", "systolic_bp", "heart_rate"
  value TEXT NOT NULL,                -- Stored as text to handle "120/80" or "Positive"
  unit TEXT,                          -- e.g. "kg", "bpm", "mg/dL"
  status TEXT,                        -- "normal", "high", "low", "critical"
  measured_at DATE DEFAULT NOW(),     -- Date of the actual measurement
  source_doc_id UUID REFERENCES uploaded_documents(id),
  source_entry_id UUID REFERENCES raw_entries(id),
  notes TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_health_metric_name ON health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_health_date ON health_metrics(measured_at DESC);
