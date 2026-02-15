// ============================================================
// INNER SELF — Gap Analysis API
// Finds missing periods in the biography
// FIXED: Uses Claude (via ai.ts) instead of OpenAI GPT-4o
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { analyzeGaps } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
    try {
        const supabase = getServiceSupabase();

        // 1. Fetch current big picture context
        const { data: persona } = await supabase
            .from('user_persona_summary')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: timeline } = await supabase
            .from('life_events_timeline')
            .select('*')
            .order('event_date', { ascending: true });

        // 2. Send to Claude for analysis (replaces OpenAI GPT-4o)
        const resultStr = await analyzeGaps(persona, timeline || []);
        const result = JSON.parse(resultStr);
        const gaps = result.gaps || [];

        // 3. Save gaps as recommended questions
        const createdQuestions = [];

        for (const gap of gaps) {
            // Check if similar question already exists
            const { data: existing } = await supabase
                .from('deepening_questions')
                .select('id')
                .eq('question_text', gap.question)
                .maybeSingle();

            if (!existing) {
                const newQ = {
                    id: uuidv4(),
                    question_text: gap.question,
                    category: 'biography_gap',
                    week_range: 'dynamic_gap',
                    created_at: new Date().toISOString()
                };

                await supabase.from('deepening_questions').insert(newQ);
                createdQuestions.push(newQ);
            }
        }

        return NextResponse.json({
            success: true,
            new_gaps: createdQuestions.length,
            questions: createdQuestions
        });

    } catch (error) {
        console.error('Gap Analysis Error:', error);
        return NextResponse.json({ error: 'Failed to analyze gaps' }, { status: 500 });
    }
}
