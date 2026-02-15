// ============================================================
// INNER SELF — Process API Route
// Brain dump → Claude extraction → embeddings → storage
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { processEntry } from '@/lib/extraction';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { text, source, audio_url, audio_duration_sec } = await request.json();

        if (!text || text.trim().length === 0) {
            return NextResponse.json(
                { error: 'No text provided' },
                { status: 400 }
            );
        }

        console.log(`[Process API] Processing entry: "${text.trim().substring(0, 60)}..." | source: ${source || 'text'}`);
        const result = await processEntry(text.trim(), source || 'text', {
            audio_url: audio_url || null,
            audio_duration_sec: audio_duration_sec || null,
        });

        if (!result.success) {
            console.error('[Process API] Processing failed:', result.error);
            return NextResponse.json(
                { error: result.error || 'Processing failed' },
                { status: 500 }
            );
        }

        const ext = result.extraction;
        console.log('[Process API] Success! Title:', ext.title, '| Task:', ext.is_task);

        // Return FULL extraction — every field the frontend or any tab might need
        return NextResponse.json({
            success: true,
            entryId: result.entryId,
            // Core
            title: ext.title,
            category: ext.category,
            content: ext.content,
            // Emotions
            mood_score: ext.mood_score,
            surface_emotion: ext.surface_emotion,
            deeper_emotion: ext.deeper_emotion,
            core_need: ext.core_need,
            triggers: ext.triggers,
            // Psychology
            defense_mechanism: ext.defense_mechanism,
            self_talk_tone: ext.self_talk_tone,
            energy_level: ext.energy_level,
            cognitive_pattern: ext.cognitive_pattern,
            beliefs_revealed: ext.beliefs_revealed,
            avoidance_signal: ext.avoidance_signal,
            growth_edge: ext.growth_edge,
            identity_persona: ext.identity_persona,
            body_signals: ext.body_signals,
            // Tasks
            is_task: ext.is_task,
            task_status: ext.task_status,
            task_due_date: ext.task_due_date,
            // People
            people_mentioned: ext.people_mentioned,
            // AI
            ai_response: ext.ai_response,
            ai_persona: ext.ai_persona_used,
            follow_up_question: ext.follow_up_question,
        });
    } catch (error) {
        console.error('Process API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
