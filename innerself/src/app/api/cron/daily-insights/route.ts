// ============================================================
// INNER SELF — Daily Insights Cron
// Analyzes last 24h of entries to find patterns/warnings/celebrations
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateDailyInsights } from '@/lib/ai';
import { getPersonaSummary } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Cron] Starting daily insights generation...');
        const supabase = getServiceSupabase();

        // 1. Get entries from last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('title, content, mood_score, category, created_at')
            .gte('created_at', oneDayAgo.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!entries || entries.length === 0) {
            console.log('[Cron] No entries in last 24h. Skipping insights.');
            return NextResponse.json({ message: 'No entries to analyze' });
        }

        // 2. Prepare context for AI
        const entriesText = entries.map(e =>
            `[${e.created_at}] [${e.category}] ${e.title}: ${e.content} (Mood: ${e.mood_score}/10)`
        ).join('\n');

        const personaSummary = await getPersonaSummary();

        // 3. Generate insights
        console.log(`[Cron] Analyzing ${entries.length} entries...`);
        const result = await generateDailyInsights(entriesText, personaSummary);

        if (!result.insights || result.insights.length === 0) {
            console.log('[Cron] AI found no significant insights.');
            return NextResponse.json({ message: 'No insights generated', count: 0 });
        }

        // 4. Store insights
        let storedCount = 0;
        for (const insight of result.insights) {
            // Check for duplicates (same text today)
            const { data: existing } = await supabase
                .from('insights')
                .select('id')
                .eq('insight_text', insight.text)
                .gte('created_at', new Date().setHours(0, 0, 0, 0) as unknown as string)
                .limit(1);

            if (!existing || existing.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: insight.text,
                    type: insight.type,
                    confidence: insight.confidence,
                    status: 'new',
                    related_entry_ids: [] // We could link, but strictly these are aggregate
                });
                storedCount++;
            }
        }

        console.log(`[Cron] Generated and stored ${storedCount} insights.`);

        return NextResponse.json({
            success: true,
            analyzed_entries: entries.length,
            generated_insights: result.insights.length,
            stored_insights: storedCount
        });

    } catch (error) {
        console.error('[Cron] Daily insights failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
