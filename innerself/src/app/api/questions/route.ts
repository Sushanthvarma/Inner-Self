// ============================================================
// INNER SELF — Deepening Questions API
// Selects the daily reflection question
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { processEntry } from '@/lib/extraction';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const supabase = getServiceSupabase();

        // 0. If category provided, fetch list (for Gaps UI etc.)
        if (category) {
            const { data: questions } = await supabase
                .from('deepening_questions')
                .select('*')
                .eq('category', category)
                .is('answered_at', null)
                .is('skipped', false)
                .order('created_at', { ascending: false })
                .limit(20);

            return NextResponse.json({ questions: questions || [] });
        }

        // 1. Check if there is already an active unanswered question (asked < 24h ago)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { data: active } = await supabase
            .from('deepening_questions')
            .select('*')
            .is('answered_at', null)
            .eq('skipped', false)
            .gte('asked_at', yesterday.toISOString())
            .limit(1)
            .maybeSingle();

        if (active) {
            return NextResponse.json({ question: active });
        }

        // 2. If no active question, select a new one
        // Priority A: High-quality AI follow-up from recent entries (last 3 days)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: recentFollowUps } = await supabase
            .from('extracted_entities')
            .select('follow_up_question, category, id')
            .gte('created_at', threeDaysAgo.toISOString())
            .not('follow_up_question', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentFollowUps && recentFollowUps.length > 0) {
            // Check if we've already used this question
            for (const item of recentFollowUps) {
                if (!item.follow_up_question) continue;

                // Simple dedup check
                const { data: exists } = await supabase
                    .from('deepening_questions')
                    .select('id')
                    .eq('question_text', item.follow_up_question)
                    .limit(1);

                if (!exists || exists.length === 0) {
                    // Promotion! Create a new deepening question from the specific follow-up
                    const newQ = {
                        id: uuidv4(),
                        question_text: item.follow_up_question,
                        category: item.category || 'reflection',
                        asked_at: new Date().toISOString(),
                        week_range: 'dynamic_ai'
                    };

                    const { data: inserted, error } = await supabase
                        .from('deepening_questions')
                        .insert(newQ)
                        .select()
                        .single();

                    if (!error) return NextResponse.json({ question: inserted });
                }
            }
        }

        // Priority B: Seed questions (never asked)
        // Select random one
        const { data: seedQuestions } = await supabase
            .from('deepening_questions')
            .select('*')
            .is('asked_at', null)
            .limit(50); // Fetch a batch to randomize JS side

        if (seedQuestions && seedQuestions.length > 0) {
            const randomQ = seedQuestions[Math.floor(Math.random() * seedQuestions.length)];

            // Mark as asked
            const { data: updated, error } = await supabase
                .from('deepening_questions')
                .update({ asked_at: new Date().toISOString() })
                .eq('id', randomQ.id)
                .select()
                .single();

            if (!error) return NextResponse.json({ question: active || updated });
        }

        // Fallback: No questions left? Reset or return nothing
        return NextResponse.json({ question: null, message: 'No new questions available' });

    } catch (error) {
        console.error('Questions API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST: Answer a question
export async function POST(request: Request) {
    try {
        const { questionId, answer, skipped } = await request.json();
        const supabase = getServiceSupabase();

        if (skipped) {
            await supabase
                .from('deepening_questions')
                .update({ skipped: true })
                .eq('id', questionId);
            return NextResponse.json({ success: true, status: 'skipped' });
        }

        if (!answer) return NextResponse.json({ error: 'Answer required' }, { status: 400 });

        // 1. Update question record
        const { data: question } = await supabase
            .from('deepening_questions')
            .update({
                answer,
                answered_at: new Date().toISOString()
            })
            .eq('id', questionId)
            .select()
            .single();

        // 2. Save and process as log entry
        const rawText = `[Deepening Question]: ${question?.question_text}\n\n[Answer]: ${answer}`;

        const result = await processEntry(rawText, 'text');

        if (!result.success) {
            console.error('Answer processing failed:', result.error);
            // Don't fail the request, just log it
        }

        return NextResponse.json({ success: true, status: 'answered' });

    } catch (error) {
        console.error('Answer API error:', error);
        return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
    }
}
