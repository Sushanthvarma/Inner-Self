// ============================================================
// INNER SELF — Biography Generation API
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateBiography } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Helper: ensure biography columns exist on the table
async function ensureBiographyColumns(supabase: ReturnType<typeof getServiceSupabase>) {
    try {
        await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE user_persona_summary 
                ADD COLUMN IF NOT EXISTS biography_narrative TEXT,
                ADD COLUMN IF NOT EXISTS biography_generated_at TIMESTAMPTZ;
            `
        });
    } catch {
        // Column might already exist or rpc not available — safe to ignore
        // The columns may have been added manually already
    }
}

export async function GET() {
    try {
        const supabase = getServiceSupabase();

        // Fetch persona row (use maybeSingle to avoid error when no row exists)
        const { data: persona } = await supabase
            .from('user_persona_summary')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!persona) {
            return NextResponse.json({
                biography: null,
                generated_at: null,
                cached: false,
            });
        }

        // Return the biography (cached or not)
        const hasBiography = persona.biography_narrative && persona.biography_narrative.trim().length > 0;

        if (hasBiography && persona.biography_generated_at) {
            const generatedAt = new Date(persona.biography_generated_at);
            const hoursSince = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
            return NextResponse.json({
                biography: persona.biography_narrative,
                generated_at: persona.biography_generated_at,
                cached: hoursSince < 24,
            });
        }

        return NextResponse.json({
            biography: null,
            generated_at: null,
            cached: false,
        });
    } catch (error) {
        console.error('Biography GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch biography' }, { status: 500 });
    }
}

export async function POST() {
    try {
        const supabase = getServiceSupabase();

        // Try to ensure columns exist (best-effort)
        await ensureBiographyColumns(supabase);

        // Gather all data (use maybeSingle so missing persona doesn't throw)
        const [personaResult, entriesResult, peopleResult, eventsResult] = await Promise.all([
            supabase.from('user_persona_summary').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('extracted_entities').select('title, content, category, mood_score, created_at').order('created_at', { ascending: false }).limit(50),
            supabase.from('people_map').select('name, relationship, mention_count, sentiment_avg').order('mention_count', { ascending: false }),
            supabase.from('life_events_timeline').select('title, description, category, significance, event_date').order('event_date', { ascending: false }),
        ]);

        const biographyText = await generateBiography({
            persona: personaResult.data || null,
            entries: entriesResult.data || [],
            people: peopleResult.data || [],
            lifeEvents: eventsResult.data || [],
        });

        // Persist the biography in user_persona_summary
        const now = new Date().toISOString();

        if (personaResult.data) {
            // Row exists — update it
            const { error: updateError } = await supabase
                .from('user_persona_summary')
                .update({
                    biography_narrative: biographyText,
                    biography_generated_at: now,
                    updated_at: now,
                })
                .eq('id', personaResult.data.id);

            if (updateError) {
                console.error('Biography update error:', updateError);
            }
        } else {
            // No persona row yet — create one with the biography
            const { error: insertError } = await supabase
                .from('user_persona_summary')
                .insert({
                    id: uuidv4(),
                    updated_at: now,
                    biography_narrative: biographyText,
                    biography_generated_at: now,
                });

            if (insertError) {
                console.error('Biography insert error:', insertError);
            }
        }

        console.log(`[Biography] Generated and saved (${biographyText.length} chars)`);

        return NextResponse.json({
            biography: biographyText,
            generated_at: now,
            cached: false,
        });
    } catch (error: unknown) {
        console.error('Biography generation error:', error);
        const message = error instanceof Error ? error.message : 'Failed to generate biography';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
