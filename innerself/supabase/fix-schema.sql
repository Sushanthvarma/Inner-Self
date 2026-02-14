-- ============================================================
-- FIX SCRIPT: Run this after the initial migration if it errored
-- ============================================================

-- Ensure insights table has the type column and index
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'insights' AND column_name = 'type'
    ) THEN
        ALTER TABLE insights ADD COLUMN type TEXT DEFAULT 'auto_extracted';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(type);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at DESC);

-- Recreate the match_embeddings function (may have been skipped)
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
AS $fn$
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
$fn$;

-- Enable RLS on all tables (safe to re-run)
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
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        -- Drop existing policy if it exists, then recreate
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Allow all for %1$s" ON %1$s', tbl);
            EXECUTE format('CREATE POLICY "Allow all for %1$s" ON %1$s FOR ALL USING (true) WITH CHECK (true)', tbl);
        EXCEPTION WHEN OTHERS THEN
            NULL; -- skip if any issue
        END;
    END LOOP;
END;
$$;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- DONE
