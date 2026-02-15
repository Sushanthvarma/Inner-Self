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

        console.log('[Process API] Success! Title:', result.extraction.title, '| Task:', result.extraction.is_task);

        return NextResponse.json({
            success: true,
            entryId: result.entryId,
            title: result.extraction.title,
            category: result.extraction.category,
            mood_score: result.extraction.mood_score,
            ai_response: result.extraction.ai_response,
            ai_persona: result.extraction.ai_persona_used,
            follow_up_question: result.extraction.follow_up_question,
            is_task: result.extraction.is_task,
            surface_emotion: result.extraction.surface_emotion,
            deeper_emotion: result.extraction.deeper_emotion,
        });
    } catch (error) {
        console.error('Process API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
