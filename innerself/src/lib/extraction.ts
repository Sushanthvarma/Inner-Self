// ============================================================
// INNER SELF — Silent Extraction Pipeline
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { getServiceSupabase } from './supabase';
import { extractFromEntry } from './ai';
import { storeEmbedding, getRecentEntries, getPersonaSummary, findSimilarEntries } from './embeddings';
import type { ExtractionResult, RawEntry } from '@/types';

export interface ProcessResult {
    entryId: string;
    extraction: ExtractionResult;
    success: boolean;
    error?: string;
}

// BUG 7: Robust date validator — catches 'null', 'unknown', 'N/A' etc.
// For health metrics: defaults to today (a measurement date is always "now" if unknown)
function validateDate(raw: string | null | undefined): string {
    if (!raw) return new Date().toISOString().split('T')[0];
    const s = raw.trim().toLowerCase();
    if (['null', 'unknown', 'n/a', 'na', 'none', 'undefined', ''].includes(s)) {
        return new Date().toISOString().split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
        return raw.trim().substring(0, 10);
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

// For LIFE EVENTS: returns null if date is unknown.
// Per Glacier Doc: "NEVER default to today for historical events."
function validateDateNullable(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    if (['null', 'unknown', 'n/a', 'na', 'none', 'undefined', ''].includes(s)) {
        return null;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
        return raw.trim().substring(0, 10);
    }
    // Handle year-only: "2015" -> "2015-01-01"
    if (/^\d{4}$/.test(raw.trim())) {
        return raw.trim() + '-01-01';
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return null;
}

// ---- Full Processing Pipeline ----
// text → save raw → extract → save entities → embed → update people → detect events
// ---- Full Processing Pipeline ----
// text → save raw → extract → save entities → embed → update people → detect events
export async function processEntry(
    rawText: string,
    source: 'text' | 'voice',
    options?: {
        audio_url?: string | null;
        audio_duration_sec?: number | null;
        existingEntryId?: string; // Support for re-processing
    }
): Promise<ProcessResult> {
    const supabase = getServiceSupabase();
    // Use existing ID if provided, else generate new
    const entryId = options?.existingEntryId || uuidv4();
    const isUpdate = !!options?.existingEntryId;

    try {
        // Step 0: Dedup check — reject duplicate text (skip if updating)
        if (!isUpdate) {
            const { data: existing } = await supabase
                .from('raw_entries')
                .select('id')
                .eq('raw_text', rawText)
                .is('deleted_at', null)
                .limit(1);

            if (existing && existing.length > 0) {
                console.log('[Pipeline] Duplicate text detected, skipping:', rawText.substring(0, 50));
                return {
                    entryId: existing[0].id,
                    extraction: {} as ExtractionResult,
                    success: true,
                    error: 'Duplicate entry — already processed',
                };
            }
        }

        // Step 1: Save or Update raw entry (immutable-ish)
        console.log(`[Pipeline] Step 1: ${isUpdate ? 'Updating' : 'Saving'} raw entry ${entryId}...`);
        const rawEntryData: Record<string, unknown> = {
            raw_text: rawText,
            source: source,
            input_metadata: {
                entry_length_chars: rawText.length,
                time_of_day: getTimeOfDay(),
            },
        };

        if (options?.audio_url) rawEntryData.audio_url = options.audio_url;
        if (options?.audio_duration_sec) rawEntryData.audio_duration_sec = options.audio_duration_sec;

        if (isUpdate) {
            // Update existing entry
            const { error: updateError } = await supabase
                .from('raw_entries')
                .update(rawEntryData)
                .eq('id', entryId);
            if (updateError) throw new Error(`Raw entry update failed: ${updateError.message}`);

            // Clean up old extracted entities to avoid duplicates
            await supabase.from('extracted_entities').delete().eq('entry_id', entryId);
        } else {
            // Insert new entry
            rawEntryData.id = entryId;
            const { error: insertError } = await supabase.from('raw_entries').insert(rawEntryData);
            if (insertError) throw new Error(`Raw entry save failed: ${insertError.message}`);
        }

        // P2 FIX: Skip Claude for very short inputs (<10 chars) — return minimal defaults
        if (rawText.trim().length < 10) {
            console.log(`[Pipeline] Input too short (${rawText.trim().length} chars). Returning minimal defaults.`);
            const minimalExtraction = {
                category: 'reflection',
                title: rawText.trim().substring(0, 30) || 'Brief note',
                content: rawText.trim(),
                mood_score: 5,
                surface_emotion: 'neutral',
                deeper_emotion: '',
                core_need: '',
                triggers: [],
                self_talk_tone: 'neutral',
                energy_level: 5,
                identity_persona: 'Seeker',
                body_signals: [],
                is_task: false,
                task_status: null,
                task_due_date: null,
                people_mentioned: [],
                beliefs_revealed: [],
                ai_response: 'Noted.',
                ai_persona_used: 'friend',
                follow_up_question: '',
            } as unknown as ExtractionResult;

            // Still save the extracted entity
            await supabase.from('extracted_entities').insert({
                id: uuidv4(),
                entry_id: entryId,
                ...minimalExtraction,
                created_at: new Date().toISOString(),
            });

            return { entryId, extraction: minimalExtraction, success: true };
        }

        // Step 2: Get context for Claude
        console.log('[Pipeline] Step 2: Fetching context...');
        let recentContext = '';
        let personaSummary = '';
        try {
            let similarContext = '';
            [recentContext, personaSummary, similarContext] = await Promise.all([
                getRecentEntries(5),
                getPersonaSummary(),
                findSimilarEntries(rawText, 5)
            ]);

            // Combine contexts
            if (similarContext) {
                recentContext = `RECENT CHRONOLOGICAL ENTRIES:\n${recentContext}\n\nSIMILAR PAST ENTRIES (RAG):\n${similarContext}`;
            }
        } catch (ctxError) {
            console.error('[Pipeline] Context fetch failed (continuing without):', ctxError);
        }

        // Step 3: Run Claude extraction
        console.log('[Pipeline] Step 3: Running Claude extraction...');
        const extraction = await extractFromEntry(rawText, recentContext, personaSummary);
        console.log('[Pipeline] Step 3 done. Title:', extraction.title, '| Category:', extraction.category);
        console.log('[Pipeline] is_task:', extraction.is_task, '| people:', extraction.people_mentioned?.length || 0);

        // Step 4: Save extracted entities (CRITICAL — must succeed)
        console.log('[Pipeline] Step 4: Saving extracted entities...');
        const { error: extractError } = await supabase
            .from('extracted_entities')
            .insert({
                id: uuidv4(),
                entry_id: entryId,
                category: extraction.category,
                title: extraction.title,
                content: extraction.content,
                mood_score: extraction.mood_score,
                surface_emotion: extraction.surface_emotion,
                deeper_emotion: extraction.deeper_emotion,
                core_need: extraction.core_need,
                triggers: extraction.triggers,
                defense_mechanism: extraction.defense_mechanism,
                self_talk_tone: extraction.self_talk_tone,
                energy_level: extraction.energy_level,
                cognitive_pattern: extraction.cognitive_pattern,
                beliefs_revealed: extraction.beliefs_revealed,
                avoidance_signal: extraction.avoidance_signal,
                growth_edge: extraction.growth_edge,
                identity_persona: extraction.identity_persona,
                body_signals: extraction.body_signals,
                is_task: extraction.is_task || false,
                task_status: extraction.is_task ? (extraction.task_status || 'pending') : null,
                task_due_date: extraction.task_due_date,
                ai_response: extraction.ai_response,
                ai_persona_used: extraction.ai_persona_used,
                follow_up_question: extraction.follow_up_question,
            });

        if (extractError) {
            console.error('[Pipeline] Step 4 FAILED:', extractError.message);
            throw new Error(`Extraction save failed: ${extractError.message}`);
        }
        console.log('[Pipeline] Step 4 done.');

        // === NON-CRITICAL STEPS: Failures are logged but don't kill the pipeline ===

        // Step 5: Generate and store embedding
        try {
            console.log('[Pipeline] Step 5: Generating embedding...');
            const embeddingText = `${extraction.title}. ${extraction.content}`;
            await storeEmbedding(entryId, embeddingText, {
                category: extraction.category,
                mood: extraction.mood_score,
                date: new Date().toISOString().split('T')[0],
                people: (extraction.people_mentioned || []).map((p) => p.name),
                persona: extraction.identity_persona,
            });
            console.log('[Pipeline] Step 5 done.');
        } catch (embError) {
            console.error('[Pipeline] Step 5 FAILED (embedding) — continuing:', embError instanceof Error ? embError.message : embError);
        }

        // Step 6: Update people map
        try {
            if (extraction.people_mentioned && extraction.people_mentioned.length > 0) {
                console.log('[Pipeline] Step 6: Updating people map with', extraction.people_mentioned.length, 'people...');
                await updatePeopleMap(extraction.people_mentioned);
                console.log('[Pipeline] Step 6 done.');
            } else {
                console.log('[Pipeline] Step 6: No people to update.');
            }
        } catch (peopleError) {
            console.error('[Pipeline] Step 6 FAILED (people map) — continuing:', peopleError instanceof Error ? peopleError.message : peopleError);
        }

        // Step 6b: Update Belief System
        try {
            if (extraction.beliefs_revealed && extraction.beliefs_revealed.length > 0) {
                console.log('[Pipeline] Step 6b: Updating belief system with', extraction.beliefs_revealed.length, 'beliefs...');
                await updateBeliefSystem(extraction.beliefs_revealed, entryId);
                console.log('[Pipeline] Step 6b done.');
            }
        } catch (beliefError) {
            console.error('[Pipeline] Step 6b FAILED (belief system) — continuing:', beliefError instanceof Error ? beliefError.message : beliefError);
        }


        // Step 7: Store life event if detected
        /* 
        NOTE: Life Event detection removed from Priority 1 extraction prompt.
        To be re-implemented in background pipeline.
        try {
            if (extraction.life_event_detected) {
                console.log('[Pipeline] Step 7: Storing life event...');
                await storeLifeEvent(extraction.life_event_detected, entryId);
                console.log('[Pipeline] Step 7 done.');
            } else {
                console.log('[Pipeline] Step 7: No life event detected.');
            }
        } catch (eventError) {
            console.error('[Pipeline] Step 7 FAILED (life event) — continuing:', eventError instanceof Error ? eventError.message : eventError);
        }
        */

        // Step 8: Store insights
        /*
        NOTE: Insights generation removed from Priority 1 extraction prompt.
        try {
            if (extraction.insights && extraction.insights.length > 0) {
                console.log('[Pipeline] Step 8: Storing', extraction.insights.length, 'insights...');
                await storeInsights(extraction.insights, entryId);
                console.log('[Pipeline] Step 8 done.');
            } else {
                console.log('[Pipeline] Step 8: No insights to store.');
            }
        } catch (insightError) {
            console.error('[Pipeline] Step 8 FAILED (insights) — continuing:', insightError instanceof Error ? insightError.message : insightError);
        }
        */

        // Step 9: Store health metrics
        /*
        NOTE: Health metrics extraction removed from Priority 1 extraction prompt.
        try {
            if (extraction.health_metrics && extraction.health_metrics.length > 0) {
                console.log('[Pipeline] Step 9: Storing', extraction.health_metrics.length, 'health metrics...');
                await storeHealthMetrics(extraction.health_metrics, entryId);
                console.log('[Pipeline] Step 9 done.');
            }
        } catch (healthError) {
            console.error('[Pipeline] Step 9 FAILED (health) — continuing:', healthError instanceof Error ? healthError.message : healthError);
        }
        */

        console.log('[Pipeline] Complete for entry', entryId);

        return {
            entryId,
            extraction,
            success: true,
        };
    } catch (error) {
        console.error('[Pipeline] FATAL ERROR for entry', entryId, ':', error);
        return {
            entryId,
            extraction: {} as ExtractionResult,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ---- Update People Map ----
export async function updatePeopleMap(
    people: { name: string; relationship: string; sentiment: string; context: string }[]
): Promise<void> {
    const supabase = getServiceSupabase();

    for (const person of people) {
        try {
            const sentimentValue = sentimentToNumber(person.sentiment);

            // Check if person exists (case-insensitive)
            const { data: existing } = await supabase
                .from('people_map')
                .select('*')
                .ilike('name', person.name)
                .single();

            if (existing) {
                // Update existing person
                const newHistory = [
                    ...(existing.sentiment_history || []),
                    {
                        date: new Date().toISOString(),
                        sentiment: sentimentValue,
                        raw_sentiment: person.sentiment,
                        context: person.context,
                    },
                ];

                const allSentiments = newHistory.map(
                    (h: { sentiment: number }) => h.sentiment
                );
                const avgSentiment =
                    allSentiments.reduce((a: number, b: number) => a + b, 0) /
                    allSentiments.length;

                await supabase
                    .from('people_map')
                    .update({
                        last_mentioned: new Date().toISOString(),
                        mention_count: existing.mention_count + 1,
                        sentiment_history: newHistory,
                        sentiment_avg: avgSentiment,
                        relationship: person.relationship || existing.relationship,
                    })
                    .eq('id', existing.id);

                console.log(`[People] Updated: ${person.name}`);
            } else {
                // Create new person
                await supabase.from('people_map').insert({
                    id: uuidv4(),
                    name: person.name,
                    relationship: person.relationship,
                    first_mentioned: new Date().toISOString(),
                    last_mentioned: new Date().toISOString(),
                    mention_count: 1,
                    sentiment_history: [
                        {
                            date: new Date().toISOString(),
                            sentiment: sentimentValue,
                            raw_sentiment: person.sentiment,
                            context: person.context,
                        },
                    ],
                    sentiment_avg: sentimentValue,
                    tags: [],
                });

                console.log(`[People] Created: ${person.name} (${person.relationship})`);
            }
        } catch (err) {
            console.error(`[People] Error processing ${person.name}:`, err instanceof Error ? err.message : err);
        }
    }
}

// ---- Store Life Event (with dedup) ----
async function storeLifeEvent(
    event: {
        title: string;
        description: string;
        significance: number;
        category: string;
        emotions: string[];
        people_involved: string[];
        event_date?: string;
    },
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    // Dedup: Check if a life event with the same title already exists
    const { data: existingEvent } = await supabase
        .from('life_events_timeline')
        .select('id')
        .ilike('title', event.title)
        .limit(1);

    if (existingEvent && existingEvent.length > 0) {
        console.log(`[LifeEvent] Duplicate detected ("${event.title}"), skipping insert.`);
        return;
    }

    // Use nullable date — NEVER default to today for historical events
    const eventDate = validateDateNullable(event.event_date);

    await supabase.from('life_events_timeline').insert({
        id: uuidv4(),
        event_date: eventDate,
        title: event.title,
        description: event.description,
        significance: event.significance,
        category: event.category,
        emotions: event.emotions,
        people_involved: event.people_involved,
        source_entry_ids: [sourceEntryId],
    });
    console.log(`[LifeEvent] Created: "${event.title}" on ${eventDate || 'unknown date'}`);
}

// ---- Store Insights (with dedup) ----
async function storeInsights(
    insights: string[],
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    for (const text of insights) {
        // Dedup: Check if similar insight already exists
        const { data: existing } = await supabase
            .from('insights')
            .select('id')
            .eq('insight_text', text)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`[Insights] Duplicate detected, skipping: "${text.substring(0, 50)}..."`);
            continue;
        }

        await supabase.from('insights').insert({
            id: uuidv4(),
            insight_text: text,
            type: 'auto_extracted',
            source_entry_id: sourceEntryId,
        });
    }
}

// ---- Store Health Metrics ----
async function storeHealthMetrics(
    metrics: { metric: string; value: string; unit: string; status: string; date: string }[],
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    const rows = metrics.map(m => ({
        id: uuidv4(),
        metric_name: m.metric,
        value: m.value,
        unit: m.unit,
        status: m.status,
        measured_at: validateDate(m.date),
        source_entry_id: sourceEntryId,
    }));

    const { error } = await supabase.from('health_metrics').insert(rows);
    if (error) {
        throw new Error(`Health metrics insert failed: ${error.message}`);
    }
    console.log(`[Health] Stored ${metrics.length} metrics.`);
}

// ---- P3: Store Dream ----
async function storeDream(
    dream: {
        dream_text: string;
        dream_type: string;
        symbols: { symbol: string; interpretation: string }[];
        emotions: string[];
        themes: string[];
        waking_connections: string;
        significance: number;
    },
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    // Dedup: check if same dream text already stored
    const { data: existing } = await supabase
        .from('dreams')
        .select('id')
        .eq('entry_id', sourceEntryId)
        .limit(1);

    if (existing && existing.length > 0) {
        console.log(`[Dream] Already stored for entry ${sourceEntryId}, skipping.`);
        return;
    }

    const { error } = await supabase.from('dreams').insert({
        id: uuidv4(),
        entry_id: sourceEntryId,
        dream_text: dream.dream_text,
        dream_type: dream.dream_type || 'normal',
        symbols: dream.symbols || [],
        emotions: dream.emotions || [],
        themes: dream.themes || [],
        waking_connections: dream.waking_connections || '',
        significance: dream.significance || 5,
        dream_date: new Date().toISOString().split('T')[0],
    });

    if (error) {
        console.error(`[Dream] Store failed:`, error);
    } else {
        console.log(`[Dream] Stored: "${dream.dream_text.substring(0, 50)}..." (${dream.dream_type})`);
    }
}

// ---- P3: Store Courage Moment ----
async function storeCourageMoment(
    courage: {
        description: string;
        courage_type: string;
        significance: number;
        people_involved: string[];
        outcome: string;
    },
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    // Dedup: check if already stored for this entry
    const { data: existing } = await supabase
        .from('courage_log')
        .select('id')
        .eq('entry_id', sourceEntryId)
        .limit(1);

    if (existing && existing.length > 0) {
        console.log(`[Courage] Already stored for entry ${sourceEntryId}, skipping.`);
        return;
    }

    const { error } = await supabase.from('courage_log').insert({
        id: uuidv4(),
        entry_id: sourceEntryId,
        description: courage.description,
        courage_type: courage.courage_type || 'boundary',
        significance: courage.significance || 5,
        people_involved: courage.people_involved || [],
        outcome: courage.outcome || '',
    });

    if (error) {
        console.error(`[Courage] Store failed:`, error);
    } else {
        console.log(`[Courage] Stored: "${courage.description.substring(0, 50)}..." (${courage.courage_type})`);
    }
}

// ---- Background Processing Pipeline ----
export async function processBackgroundFeatures(
    entryId: string,
    rawText: string
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`[Background] Starting deep analysis for entry ${entryId}...`);

        // 1. Get context (lightweight)
        const recentContext = await getRecentEntries(3);

        // 2. Extract features
        // Dynamic import to avoid circular dependency if any
        const { extractBackgroundFeatures } = await import('./ai');
        const features = await extractBackgroundFeatures(rawText, recentContext);

        console.log(`[Background] Extracted: ${features.life_event_detected ? '1 Life Event' : '0 Events'}, ${features.health_metrics.length} Health Metrics, ${features.insights.length} Insights`);

        // 3. Store results
        if (features.life_event_detected) {
            await storeLifeEvent(features.life_event_detected, entryId);
        }

        // BUG 3: Health metrics should ONLY come from uploaded documents (process-document route).
        // Brain dump extraction is too unreliable and causes duplicates.
        // if (features.health_metrics.length > 0) {
        //     await storeHealthMetrics(features.health_metrics, entryId);
        // }
        if (features.health_metrics.length > 0) {
            console.log(`[Background] Skipping ${features.health_metrics.length} health metrics from brain dump — health data only accepted from uploaded documents.`);
        }

        if (features.insights.length > 0) {
            await storeInsights(features.insights, entryId);
        }

        // P3: Store dream if detected
        if (features.dream_detected) {
            await storeDream(features.dream_detected, entryId);
        }

        // P3: Store courage moment if detected
        if (features.courage_detected) {
            await storeCourageMoment(features.courage_detected, entryId);
        }

        return { success: true };
    } catch (error) {
        console.error(`[Background] Error processing entry ${entryId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// ---- Update Belief System (with dedup) ----
export async function updateBeliefSystem(
    beliefs: string[],
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    for (const beliefText of beliefs) {
        try {
            // Check if belief exists (simple case-insensitive match for now)
            const { data: existing } = await supabase
                .from('belief_system')
                .select('*')
                .ilike('belief_text', beliefText)
                .single();

            if (existing) {
                // Reinforce existing belief
                await supabase
                    .from('belief_system')
                    .update({
                        last_reinforced: new Date().toISOString(),
                        reinforcement_count: existing.reinforcement_count + 1,
                        status: 'active'
                    })
                    .eq('id', existing.id);
                console.log(`[Belief] Reinforced: "${beliefText.substring(0, 30)}..."`);
            } else {
                // Create new belief
                await supabase.from('belief_system').insert({
                    id: uuidv4(),
                    belief_text: beliefText,
                    domain: 'general', // Default for now
                    first_surfaced: new Date().toISOString(),
                    last_reinforced: new Date().toISOString(),
                    reinforcement_count: 1,
                    status: 'active'
                });
                console.log(`[Belief] Created: "${beliefText.substring(0, 30)}..."`);
            }
        } catch (err) {
            console.error(`[Belief] Error processing "${beliefText.substring(0, 20)}...":`, err instanceof Error ? err.message : err);
        }
    }
}

// ---- Helpers ----
// ---- Helpers ----
function sentimentToNumber(sentiment: string): number {
    const s = (sentiment || '').toLowerCase();

    // 1. Exact matches
    const map: Record<string, number> = {
        'positive': 8, 'joy': 9, 'grateful': 9, 'excited': 8, 'confident': 8,
        'love': 9, 'proud': 9, 'happy': 8, 'determined': 8, 'peaceful': 7,
        'neutral': 5, 'calm': 6, 'balanced': 5, 'indifferent': 5,
        'negative': 2, 'angry': 2, 'frustrated': 3, 'sad': 3, 'anxious': 3,
        'hurt': 2, 'betrayed': 1, 'guilty': 3, 'ashamed': 2, 'hopeless': 2
    };

    if (map[s]) return map[s];

    // 2. Compound/Mixed handling
    // Count positive/negative words
    const positives = ['love', 'good', 'great', 'happy', 'joy', 'fun', 'win', 'safe', 'calm', 'proud'];
    const negatives = ['bad', 'sad', 'hate', 'anger', 'angry', 'fear', 'hurt', 'pain', 'lost', 'hard'];

    let score = 5;
    let posCount = 0;
    let negCount = 0;

    positives.forEach(w => { if (s.includes(w)) posCount++; });
    negatives.forEach(w => { if (s.includes(w)) negCount++; });

    if (posCount > negCount) score = 7;
    else if (negCount > posCount) score = 3;
    else if (s.includes('mix') || s.includes('bittersweet')) score = 5;

    return score;
}

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'late_night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}
