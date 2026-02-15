// ============================================================
// INNER SELF — Persona Summary Update Cron
// Rewrites the "God View" document based on recent entries
// Runs weekly to keep the AI's understanding fresh
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { updatePersonaSummary } from '@/lib/ai';
import { getPersonaSummary } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Cron] Starting persona summary update...');
        const supabase = getServiceSupabase();

        // 1. Get current summary
        const currentSummary = await getPersonaSummary();

        // 2. Get entries from last 30 days for context
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('title, content, category, mood_score, deep_emotional_analysis, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!entries || entries.length < 10) {
            console.log('[Cron] Not enough data (<10 entries in 30d) to update persona summary.');
            return NextResponse.json({ message: 'Insufficient data' });
        }

        const entriesText = entries.map(e =>
            `[${e.created_at.split('T')[0]}] [${e.category}] ${e.title}: ${e.content} (Mood: ${e.mood_score})`
        ).join('\n');

        // 3. Update summary
        console.log(`[Cron] Updating persona based on ${entries.length} recent entries...`);
        const newSummaryStr = await updatePersonaSummary(currentSummary, entriesText);
        const newSummary = JSON.parse(newSummaryStr);

        // 4. Save to DB (handle singleton row logic)
        const { data: existingRow } = await supabase
            .from('user_persona_summary')
            .select('id')
            .limit(1);

        if (existingRow && existingRow.length > 0) {
            // Update existing
            await supabase
                .from('user_persona_summary')
                .update({
                    ...newSummary,
                    last_updated: new Date().toISOString()
                })
                .eq('id', existingRow[0].id);
        } else {
            // Insert new
            await supabase
                .from('user_persona_summary')
                .insert({
                    ...newSummary,
                    last_updated: new Date().toISOString()
                });
        }

        console.log('[Cron] Persona summary updated successfully.');

        return NextResponse.json({ success: true, updated_at: new Date().toISOString() });

    } catch (error) {
        console.error('[Cron] Persona summary update failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
