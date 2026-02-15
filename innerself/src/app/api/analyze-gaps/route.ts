// ============================================================
// INNER SELF — Gap Analysis API
// Finds missing periods in the biography
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60s for analysis

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();

        // 1. Fetch current big picture context
        const { data: persona } = await supabase
            .from('user_persona_summary')
            .select('*')
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data: timeline } = await supabase
            .from('life_events_timeline')
            .select('*')
            .order('event_date', { ascending: true });

        // 2. Send to Anthropic/OpenAI for analysis
        // We use the 'biography' generation prompt logic but focus on GAPS
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }); // Or use Anthropic if preferred

        const prompt = `
        You are the Biography Detective for Inner Self.
        Your job is to read the current known life timeline and identify SIGNIFICANT GAPS or VAGUE AREAS.

        CURRENT CONTEXT:
        Persona: ${JSON.stringify(persona || {})}
        Timeline Events: ${JSON.stringify(timeline || [])}

        TASK:
        1. Identify 3-5 major gaps where information is missing (e.g. "What happened between 2012 and 2014?", "How did X relationship end?", "Why did you move to Y?").
        2. Formulate a direct, compassionate question for each gap.
        3. Prioritize by chronological order or emotional weight.

        OUTPUT JSON:
        {
            "gaps": [
                {
                    "question": "string",
                    "context": "string (why this is missing)",
                    "category": "career | relationship | personal | health"
                }
            ]
        }
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o", // Strong model for reasoning
            messages: [
                { role: "system", content: "You are a psychological biographer." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || '{}');
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
                    category: 'biography_gap', // Special category
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
