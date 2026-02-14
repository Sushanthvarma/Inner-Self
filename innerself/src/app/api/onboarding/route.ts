// ============================================================
// INNER SELF — Onboarding API Route (with skip/resume support)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { processOnboarding } from '@/lib/ai';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { ONBOARDING_QUESTIONS } from '@/lib/personas';

export const dynamic = 'force-dynamic';

// POST: Submit answers (full or partial)
export async function POST(request: NextRequest) {
    try {
        const { answers } = await request.json();

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return NextResponse.json(
                { error: 'No onboarding answers provided' },
                { status: 400 }
            );
        }

        const supabase = getServiceSupabase();

        // Save all onboarding answers
        const answerRows = answers.map(
            (a: { question: string; answer: string }, i: number) => ({
                id: uuidv4(),
                question_number: i + 1,
                question_text: a.question,
                answer_text: a.answer,
            })
        );

        await supabase.from('onboarding_answers').insert(answerRows);

        // Process with Claude to generate initial persona summary
        const result = await processOnboarding(answers);
        const parsed = JSON.parse(result);

        // Save persona summary
        await supabase.from('user_persona_summary').insert({
            id: uuidv4(),
            ...parsed.persona_summary,
        });

        // Save extracted people
        if (parsed.people && parsed.people.length > 0) {
            const now = new Date().toISOString();
            const peopleRows = parsed.people.map(
                (p: { name: string; relationship: string; sentiment_avg: number; tags: string[] }) => ({
                    id: uuidv4(),
                    name: p.name,
                    relationship: p.relationship,
                    first_mentioned: now,
                    last_mentioned: now,
                    mention_count: 1,
                    sentiment_avg: p.sentiment_avg,
                    tags: p.tags || [],
                    sentiment_history: [
                        { date: now, sentiment: p.sentiment_avg, context: 'onboarding' },
                    ],
                })
            );

            await supabase.from('people_map').insert(peopleRows);
        }

        // Save life events
        if (parsed.life_events && parsed.life_events.length > 0) {
            const eventRows = parsed.life_events.map(
                (e: { title: string; description: string; significance: number; category: string; emotions: string[] }) => ({
                    id: uuidv4(),
                    event_date: new Date().toISOString().split('T')[0],
                    title: e.title,
                    description: e.description,
                    significance: e.significance,
                    category: e.category,
                    emotions: e.emotions,
                })
            );

            await supabase.from('life_events_timeline').insert(eventRows);
        }

        // Save initial insights
        if (parsed.insights && parsed.insights.length > 0) {
            const insightRows = parsed.insights.map((text: string) => ({
                id: uuidv4(),
                insight_text: text,
                type: 'onboarding',
            }));

            await supabase.from('insights').insert(insightRows);
        }

        // Mark onboarding as completed
        const isComplete = answers.length >= ONBOARDING_QUESTIONS.length;
        await supabase.from('app_config').upsert({
            key: 'onboarding_status',
            value: {
                status: isComplete ? 'completed' : 'partial',
                answered_count: answers.length,
                total_questions: ONBOARDING_QUESTIONS.length,
                completed_at: isComplete ? new Date().toISOString() : null,
            },
            updated_at: new Date().toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Onboarding processed successfully',
            peopleCount: parsed.people?.length || 0,
            eventsCount: parsed.life_events?.length || 0,
            insightsCount: parsed.insights?.length || 0,
        });
    } catch (error) {
        console.error('Onboarding API error:', error);
        return NextResponse.json(
            { error: 'Failed to process onboarding' },
            { status: 500 }
        );
    }
}

// PATCH: Skip onboarding (save any partial answers without AI processing)
export async function PATCH(request: NextRequest) {
    try {
        const { answers } = await request.json().catch(() => ({ answers: [] }));
        const supabase = getServiceSupabase();

        // Save any partial answers
        if (answers && answers.length > 0) {
            const answerRows = answers.map(
                (a: { question: string; answer: string }, i: number) => ({
                    id: uuidv4(),
                    question_number: i + 1,
                    question_text: a.question,
                    answer_text: a.answer,
                })
            );
            await supabase.from('onboarding_answers').insert(answerRows);
        }

        // Mark as skipped
        await supabase.from('app_config').upsert({
            key: 'onboarding_status',
            value: {
                status: 'skipped',
                answered_count: answers?.length || 0,
                total_questions: ONBOARDING_QUESTIONS.length,
                skipped_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
        });

        return NextResponse.json({ success: true, status: 'skipped' });
    } catch (error) {
        console.error('Skip onboarding error:', error);
        return NextResponse.json(
            { error: 'Failed to skip onboarding' },
            { status: 500 }
        );
    }
}

// GET: Check onboarding status
export async function GET() {
    try {
        const supabase = getServiceSupabase();

        // Check app_config for onboarding status
        const { data: config } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'onboarding_status')
            .single();

        if (config) {
            const status = config.value as {
                status: string;
                answered_count: number;
                total_questions: number;
            };
            return NextResponse.json({
                completed: status.status === 'completed',
                skipped: status.status === 'skipped',
                partial: status.status === 'partial',
                answeredCount: status.answered_count,
                totalQuestions: status.total_questions,
            });
        }

        // Fallback: check if any onboarding answers exist
        const { data } = await supabase
            .from('onboarding_answers')
            .select('id')
            .limit(1);

        return NextResponse.json({
            completed: data && data.length > 0,
            skipped: false,
            partial: false,
            answeredCount: 0,
            totalQuestions: ONBOARDING_QUESTIONS.length,
        });
    } catch (error) {
        console.error('Onboarding check error:', error);
        return NextResponse.json({
            completed: false,
            skipped: false,
            partial: false,
            answeredCount: 0,
            totalQuestions: ONBOARDING_QUESTIONS.length,
        });
    }
}
