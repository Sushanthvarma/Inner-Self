// ============================================================
// INNER SELF — Chat API Route (RAG-powered conversation)
// Deep persona knowledge + data extraction from conversations
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

        // Save conversation to database
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

        // === BACKGROUND: Extract data from chat and feed into master system ===
        // This runs asynchronously — don't block the response
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

// ---- Background: Extract meaningful data from chat messages and store in master DB ----
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

    console.log(`[Chat] Extracting data from chat message: ${extraction.insights.length} insights, ${extraction.people_mentioned.length} people`);

    // 1. Store as a raw entry + extracted entity (so it appears in Log and feeds into everything)
    const entryId = uuidv4();
    const now = new Date().toISOString();

    await supabase.from('raw_entries').insert({
        id: entryId,
        created_at: now,
        raw_text: message,
        source: 'text',
        input_metadata: { device: 'chat', time_of_day: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening' },
    });

    await supabase.from('extracted_entities').insert({
        id: uuidv4(),
        entry_id: entryId,
        category: extraction.is_task ? 'task' : 'reflection',
        title: extraction.task_title || message.substring(0, 60),
        content: message,
        mood_score: extraction.mood_score || 5,
        surface_emotion: 'shared in chat',
        deeper_emotion: '',
        core_need: '',
        triggers: [],
        self_talk_tone: 'neutral',
        energy_level: 5,
        identity_persona: 'Friend',
        body_signals: [],
        is_task: extraction.is_task || false,
        task_status: extraction.is_task ? 'pending' : null,
        task_due_date: extraction.task_due_date || null,
        people_mentioned: extraction.people_mentioned || [],
        ai_response: '',
        ai_persona_used: persona,
        created_at: now,
    });

    // 2. Update people map
    for (const person of extraction.people_mentioned) {
        if (!person.name || person.name.length < 2) continue;

        const { data: existing } = await supabase
            .from('people_map')
            .select('id, mention_count')
            .eq('name', person.name)
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

    // 3. Store life event if detected
    if (extraction.life_event_detected) {
        const event = extraction.life_event_detected;
        await supabase.from('life_events_timeline').insert({
            id: uuidv4(),
            event_date: now.split('T')[0],
            title: event.title,
            description: event.description,
            significance: event.significance || 5,
            category: event.category || 'personal',
            emotions: event.emotions || [],
            people_involved: event.people_involved || [],
            source_entry_ids: [entryId],
        });
    }

    // 4. Store insights
    for (const insight of extraction.insights) {
        await supabase.from('insights').insert({
            id: uuidv4(),
            created_at: now,
            insight_text: insight,
            type: 'chat_observation',
            source_entry_id: entryId,
        });
    }
}
