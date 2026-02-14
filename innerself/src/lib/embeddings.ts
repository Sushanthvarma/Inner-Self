// ============================================================
// INNER SELF — OpenAI Embeddings + RAG Search
// ============================================================
import OpenAI from 'openai';
import { getServiceSupabase } from './supabase';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) {
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    }
    return _openai;
}

// ---- Generate Embedding Vector ----
export async function generateEmbedding(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: 1536,
    });

    return response.data[0].embedding;
}

// ---- Store Embedding ----
export async function storeEmbedding(
    entryId: string,
    text: string,
    metadata: {
        category: string;
        mood: number;
        date: string;
        people: string[];
        persona: string;
    }
): Promise<void> {
    const embedding = await generateEmbedding(text);
    const supabase = getServiceSupabase();

    const { error } = await supabase.from('embeddings').insert({
        entry_id: entryId,
        embedding: embedding,
        content_text: text,
        metadata: metadata,
    });

    if (error) {
        console.error('Error storing embedding:', error);
        throw error;
    }
}

// ---- Semantic Search (Vector Similarity) ----
export async function semanticSearch(
    queryText: string,
    limit: number = 10,
    filters?: {
        category?: string;
        minMood?: number;
        maxMood?: number;
        person?: string;
        startDate?: string;
        endDate?: string;
    }
): Promise<
    {
        entry_id: string;
        content_text: string;
        similarity: number;
        metadata: Record<string, unknown>;
    }[]
> {
    const queryEmbedding = await generateEmbedding(queryText);
    const supabase = getServiceSupabase();

    // Use the pgvector cosine similarity search function
    const { data, error } = await supabase.rpc('match_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: limit,
        filter_category: filters?.category || null,
        filter_person: filters?.person || null,
        filter_start_date: filters?.startDate || null,
        filter_end_date: filters?.endDate || null,
    });

    if (error) {
        console.error('Semantic search error:', error);
        throw error;
    }

    return data || [];
}

// ---- Hybrid Search (Metadata + Vector) ----
export async function hybridSearch(
    queryText: string,
    limit: number = 15
): Promise<string> {
    const results = await semanticSearch(queryText, limit);

    if (results.length === 0) {
        return 'No relevant historical entries found.';
    }

    return results
        .map(
            (r, i) =>
                `[Entry ${i + 1} | Relevance: ${(r.similarity * 100).toFixed(0)}%]\n${r.content_text}`
        )
        .join('\n\n');
}

// ---- Get Recent Entries for Context ----
export async function getRecentEntries(
    count: number = 10
): Promise<string> {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
        .from('extracted_entities')
        .select('title, content, category, mood_score, ai_persona_used, created_at')
        .order('created_at', { ascending: false })
        .limit(count);

    if (error) {
        console.error('Error fetching recent entries:', error);
        return '';
    }

    if (!data || data.length === 0) return '';

    return data
        .map(
            (e) =>
                `[${e.category}] ${e.title}: ${e.content} (mood: ${e.mood_score}/10)`
        )
        .join('\n');
}

// ---- Get Persona Summary ----
export async function getPersonaSummary(): Promise<string> {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
        .from('user_persona_summary')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error || !data) return '';

    return data.full_psychological_profile || JSON.stringify(data);
}
