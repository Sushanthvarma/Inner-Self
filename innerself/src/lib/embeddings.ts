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

// ---- Find Similar Entries (RAG Context) ----
export async function findSimilarEntries(
    queryText: string,
    limit: number = 5
): Promise<string> {
    try {
        const results = await semanticSearch(queryText, limit);

        if (results.length === 0) return '';

        return results
            .map(
                (r) =>
                    `[SIMILAR PAST ENTRY]: ${r.content_text} (similarity: ${(r.similarity * 100).toFixed(0)}%)`
            )
            .join('\n');
    } catch (error) {
        console.error('Error finding similar entries:', error);
        return '';
    }
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

// ---- Get Enriched Context for Chat (rich structured data) ----
export async function getEnrichedChatContext(): Promise<{
    recentMood: string;
    activeGoals: string;
    keyPeople: string;
    recentEvents: string;
    currentStruggles: string;
}> {
    const supabase = getServiceSupabase();

    // Fetch all context in parallel
    const [personaResult, recentEntriesResult, peopleResult, eventsResult] = await Promise.all([
        supabase.from('user_persona_summary').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('extracted_entities')
            .select('title, content, category, mood_score, energy_level, surface_emotion, deeper_emotion, identity_persona, self_talk_tone, ai_persona_used, created_at')
            .order('created_at', { ascending: false })
            .limit(15),
        supabase.from('people_map')
            .select('name, relationship, mention_count, sentiment_avg, tags, notes')
            .order('mention_count', { ascending: false })
            .limit(20),
        supabase.from('life_events_timeline')
            .select('title, description, category, significance, event_date, emotions')
            .order('event_date', { ascending: false })
            .limit(10),
    ]);

    const persona = personaResult.data;
    const entries = recentEntriesResult.data || [];
    const people = peopleResult.data || [];
    const events = eventsResult.data || [];

    // Build recent mood summary
    const recentMoods = entries.slice(0, 7);
    const avgMood = recentMoods.length > 0
        ? (recentMoods.reduce((sum, e) => sum + (e.mood_score || 5), 0) / recentMoods.length).toFixed(1)
        : '5.0';
    const recentMood = recentMoods.length > 0
        ? `Average mood: ${avgMood}/10 over last ${recentMoods.length} entries.\n` +
        recentMoods.map(e =>
            `- "${e.title}" (mood: ${e.mood_score}/10, feeling: ${e.surface_emotion}${e.deeper_emotion ? ' → ' + e.deeper_emotion : ''}, energy: ${e.energy_level}/10)`
        ).join('\n')
        : 'No recent mood data.';

    // Build goals
    const activeGoals = persona?.active_goals
        ? (Array.isArray(persona.active_goals)
            ? persona.active_goals.map((g: { goal: string; status: string }) => `- ${g.goal} (${g.status})`).join('\n')
            : JSON.stringify(persona.active_goals))
        : 'No active goals tracked yet.';

    // Build people
    const keyPeople = people.length > 0
        ? people.map(p =>
            `- ${p.name} (${p.relationship || 'unknown relationship'}) — mentioned ${p.mention_count} times, sentiment: ${p.sentiment_avg?.toFixed(1) || '?'}/10${p.tags?.length ? ', tags: ' + p.tags.join(', ') : ''}${p.notes ? ' — note: ' + p.notes : ''}`
        ).join('\n')
        : 'No people tracked yet.';

    // Build events
    const recentEvents = events.length > 0
        ? events.map(e =>
            `- [${e.category}] "${e.title}": ${e.description} (significance: ${e.significance}/10, date: ${e.event_date}${e.emotions?.length ? ', emotions: ' + e.emotions.join(', ') : ''})`
        ).join('\n')
        : 'No life events tracked yet.';

    // Build struggles / patterns
    const struggles = [];
    if (persona?.currently_avoiding) struggles.push(`Currently avoiding: ${persona.currently_avoiding}`);
    if (persona?.biggest_growth_edge) struggles.push(`Growth edge: ${persona.biggest_growth_edge}`);
    if (persona?.recurring_patterns?.length) struggles.push(`Recurring patterns: ${persona.recurring_patterns.join(', ')}`);
    if (persona?.self_talk_ratio) {
        const ratio = persona.self_talk_ratio as { positive?: number; neutral?: number; critical?: number };
        struggles.push(`Self-talk: ${ratio.positive || 0}% positive, ${ratio.neutral || 0}% neutral, ${ratio.critical || 0}% critical`);
    }
    if (persona?.baseline_mood) struggles.push(`Baseline mood: ${persona.baseline_mood}`);
    if (persona?.life_chapter_title) struggles.push(`Current life chapter: "${persona.life_chapter_title}" — ${persona.life_chapter_narrative || ''}`);

    const currentStruggles = struggles.length > 0
        ? struggles.join('\n')
        : 'No struggle/pattern data yet.';

    return { recentMood, activeGoals, keyPeople, recentEvents, currentStruggles };
}
