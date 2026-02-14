// ============================================================
// INNER SELF — Silent Extraction Pipeline
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { getServiceSupabase } from './supabase';
import { extractFromEntry } from './ai';
import { storeEmbedding, getRecentEntries, getPersonaSummary } from './embeddings';
import type { ExtractionResult, RawEntry } from '@/types';

export interface ProcessResult {
    entryId: string;
    extraction: ExtractionResult;
    success: boolean;
    error?: string;
}

// ---- Full Processing Pipeline ----
// text → save raw → extract → save entities → embed → update people → detect events
export async function processEntry(
    rawText: string,
    source: 'text' | 'voice'
): Promise<ProcessResult> {
    const supabase = getServiceSupabase();
    const entryId = uuidv4();

    try {
        // Step 1: Save raw entry (immutable)
        const { error: rawError } = await supabase.from('raw_entries').insert({
            id: entryId,
            raw_text: rawText,
            source: source,
            input_metadata: {
                entry_length_chars: rawText.length,
                time_of_day: getTimeOfDay(),
            },
        });

        if (rawError) throw new Error(`Raw entry save failed: ${rawError.message}`);

        // Step 2: Get context for Claude
        const [recentContext, personaSummary] = await Promise.all([
            getRecentEntries(10),
            getPersonaSummary(),
        ]);

        // Step 3: Run Claude extraction
        const extraction = await extractFromEntry(rawText, recentContext, personaSummary);

        // Step 4: Save extracted entities
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
                is_task: extraction.is_task,
                task_status: extraction.task_status,
                task_due_date: extraction.task_due_date,
                people_mentioned: extraction.people_mentioned,
                ai_response: extraction.ai_response,
                ai_persona_used: extraction.ai_persona_selected,
                follow_up_question: extraction.follow_up_question,
            });

        if (extractError)
            throw new Error(`Extraction save failed: ${extractError.message}`);

        // Step 5: Generate and store embedding
        const embeddingText = `${extraction.title}. ${extraction.content}`;
        await storeEmbedding(entryId, embeddingText, {
            category: extraction.category,
            mood: extraction.mood_score,
            date: new Date().toISOString().split('T')[0],
            people: extraction.people_mentioned.map((p) => p.name),
            persona: extraction.identity_persona,
        });

        // Step 6: Update people map
        if (extraction.people_mentioned.length > 0) {
            await updatePeopleMap(extraction.people_mentioned);
        }

        // Step 7: Store life event if detected
        if (extraction.life_event_detected) {
            await storeLifeEvent(extraction.life_event_detected, entryId);
        }

        // Step 8: Store insights
        if (extraction.insights.length > 0) {
            await storeInsights(extraction.insights, entryId);
        }

        return {
            entryId,
            extraction,
            success: true,
        };
    } catch (error) {
        console.error('Processing pipeline error:', error);
        return {
            entryId,
            extraction: {} as ExtractionResult,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ---- Update People Map ----
async function updatePeopleMap(
    people: { name: string; relationship: string; sentiment: string; context: string }[]
): Promise<void> {
    const supabase = getServiceSupabase();

    for (const person of people) {
        const sentimentValue = sentimentToNumber(person.sentiment);

        // Check if person exists
        const { data: existing } = await supabase
            .from('people_map')
            .select('*')
            .eq('name', person.name)
            .single();

        if (existing) {
            // Update existing person
            const newHistory = [
                ...(existing.sentiment_history || []),
                {
                    date: new Date().toISOString(),
                    sentiment: sentimentValue,
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
                        context: person.context,
                    },
                ],
                sentiment_avg: sentimentValue,
                tags: [],
            });
        }
    }
}

// ---- Store Life Event ----
async function storeLifeEvent(
    event: {
        title: string;
        description: string;
        significance: number;
        category: string;
        emotions: string[];
        people_involved: string[];
    },
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    await supabase.from('life_events_timeline').insert({
        id: uuidv4(),
        event_date: new Date().toISOString().split('T')[0],
        title: event.title,
        description: event.description,
        significance: event.significance,
        category: event.category,
        emotions: event.emotions,
        people_involved: event.people_involved,
        source_entry_ids: [sourceEntryId],
    });
}

// ---- Store Insights ----
async function storeInsights(
    insights: string[],
    sourceEntryId: string
): Promise<void> {
    const supabase = getServiceSupabase();

    const insightRows = insights.map((text) => ({
        id: uuidv4(),
        insight_text: text,
        type: 'auto_extracted',
        source_entry_id: sourceEntryId,
    }));

    await supabase.from('insights').insert(insightRows);
}

// ---- Helpers ----
function sentimentToNumber(sentiment: string): number {
    switch (sentiment.toLowerCase()) {
        case 'positive':
            return 8;
        case 'neutral':
            return 5;
        case 'negative':
            return 2;
        case 'mixed':
            return 5;
        default:
            return 5;
    }
}

function getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 6) return 'late_night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
}
