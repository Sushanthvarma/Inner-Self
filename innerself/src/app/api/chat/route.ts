// ============================================================
// INNER SELF — Chat API Route (RAG-powered conversation)
// FIXED: No more ghost entries in raw_entries/extracted_entities
// Chat data goes to conversations ONLY. People + life events still updated.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse, extractFromChatMessage } from '@/lib/ai';
import { hybridSearch, getPersonaSummary, getEnrichedChatContext } from '@/lib/embeddings';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { AIPersona } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { message, persona, conversationHistory } = await request.json();

        if (!message || message.trim().length === 0) {
            return NextResponse.json(
                { error: 'No message provided' },
                { status: 400 }
            );
        }

        const selectedPersona: AIPersona = persona || 'friend';

        // Fetch all context in parallel: RAG search, persona summary, and enriched data
        const [ragContext, personaSummary, enrichedContext] = await Promise.all([
            hybridSearch(message, 15).catch(() => ''),
            getPersonaSummary().catch(() => ''),
            getEnrichedChatContext().catch(() => ({
                recentMood: '',
                activeGoals: '',
                keyPeople: '',
                recentEvents: '',
                currentStruggles: '',
            })),
        ]);

        // Generate AI response with FULL context
        const aiResponse = await generateChatResponse(
            message,
            selectedPersona,
            conversationHistory || [],
            ragContext,
            personaSummary,
            enrichedContext
        );

        // Save conversation to database (conversations table ONLY)
        const supabase = getServiceSupabase();
        const userMsgId = uuidv4();
        const assistantMsgId = uuidv4();

        await supabase.from('conversations').insert([
            {
                id: userMsgId,
                role: 'user',
                content: message,
                persona_used: selectedPersona,
            },
            {
                id: assistantMsgId,
                role: 'assistant',
                content: aiResponse,
                persona_used: selectedPersona,
            },
        ]);

        // === BACKGROUND: Extract ONLY people + life events from chat ===
        // FIXED: NO raw_entries or extracted_entities created (ghost entry bug)
        extractAndStoreFromChat(message, selectedPersona, personaSummary, supabase).catch(err => {
            console.error('[Chat] Background extraction error:', err);
        });

        return NextResponse.json({
            response: aiResponse,
            persona: selectedPersona,
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ---- Background: Extract people + life events from chat (NO raw_entries/extracted_entities) ----
async function extractAndStoreFromChat(
    message: string,
    persona: AIPersona,
    personaSummary: string,
    supabase: ReturnType<typeof getServiceSupabase>
) {
    // Skip very short or trivial messages
    if (message.trim().length < 15) return;

    const extraction = await extractFromChatMessage(message, persona, personaSummary);

    if (!extraction.should_extract) return;

    console.log(`[Chat] Extracting from chat (NO ghost entries): ${extraction.people_mentioned.length} people, ${extraction.life_event_detected ? '1 event' : '0 events'}`);

    const now = new Date().toISOString();

    // 1. Update people map (this is valid — chat reveals relationships)
    for (const person of extraction.people_mentioned) {
        if (!person.name || person.name.length < 2) continue;

        const { data: existing } = await supabase
            .from('people_map')
            .select('id, mention_count')
            .ilike('name', person.name)
            .maybeSingle();

        if (existing) {
            await supabase.from('people_map').update({
                mention_count: (existing.mention_count || 0) + 1,
                last_mentioned: now,
            }).eq('id', existing.id);
        } else {
            await supabase.from('people_map').insert({
                id: uuidv4(),
                name: person.name,
                relationship: person.relationship || 'unknown',
                first_mentioned: now,
                last_mentioned: now,
                mention_count: 1,
                sentiment_avg: person.sentiment === 'positive' ? 7 : person.sentiment === 'negative' ? 3 : 5,
                tags: [],
            });
        }
    }

    // 2. Store life event if detected (this is valid — chat reveals events)
    if (extraction.life_event_detected) {
        const event = extraction.life_event_detected;
        // Dedup: check if similar event already exists
        const { data: existingEvent } = await supabase
            .from('life_events_timeline')
            .select('id')
            .ilike('title', event.title)
            .limit(1);

        if (!existingEvent || existingEvent.length === 0) {
            await supabase.from('life_events_timeline').insert({
                id: uuidv4(),
                event_date: now.split('T')[0],
                title: event.title,
                description: event.description,
                significance: event.significance || 5,
                category: event.category || 'personal',
                emotions: event.emotions || [],
                people_involved: event.people_involved || [],
                source_entry_ids: [],
            });
        }
    }

    // 3. Store insights (to insights table only, not raw_entries)
    for (const insight of extraction.insights) {
        await supabase.from('insights').insert({
            id: uuidv4(),
            created_at: now,
            insight_text: insight,
            type: 'chat_observation',
        });
    }
}
