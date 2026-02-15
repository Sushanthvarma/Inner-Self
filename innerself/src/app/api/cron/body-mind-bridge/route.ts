// ============================================================
// INNER SELF — Body-Mind Bridge Cron (Weekly)
// Correlates body_signals with emotional patterns.
// Runs weekly (Sunday night) alongside other weekly crons.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { analyzeBodyMindCorrelations } from '@/lib/ai';
import { getPersonaSummary } from '@/lib/embeddings';
import { verifyCronAuth, startCronRun, completeCronRun } from '@/lib/cron-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const runId = await startCronRun('body_mind_bridge');

    try {
        console.log('[Cron] Starting Body-Mind Bridge analysis...');
        const supabase = getServiceSupabase();

        // 1. Get entries from last 30 days with body signals
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('title, content, mood_score, energy_level, body_signals, triggers, surface_emotion, deeper_emotion, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!entries || entries.length < 10) {
            console.log('[Cron] Not enough entries (<10) for body-mind analysis.');
            await completeCronRun(runId, 'completed', { message: 'Insufficient data', entries: entries?.length || 0 });
            return NextResponse.json({ message: 'Insufficient data' });
        }

        // 2. Count how many have body signals
        const withBodySignals = entries.filter(e => e.body_signals && e.body_signals.length > 0);
        console.log(`[Cron] ${entries.length} total entries, ${withBodySignals.length} with body signals.`);

        if (withBodySignals.length < 3) {
            console.log('[Cron] Not enough body signals for meaningful correlation.');
            await completeCronRun(runId, 'completed', { message: 'Few body signals', entries: entries.length, with_body: withBodySignals.length });
            return NextResponse.json({ message: 'Insufficient body signal data' });
        }

        // 3. Prepare entries text for AI
        const entriesText = entries.map(e =>
            `[${e.created_at.split('T')[0]}] Mood: ${e.mood_score}/10 | Energy: ${e.energy_level}/10 | Emotion: ${e.surface_emotion}${e.deeper_emotion ? ` (deeper: ${e.deeper_emotion})` : ''} | Body: ${(e.body_signals || []).join(', ') || 'none'} | Triggers: ${(e.triggers || []).join(', ') || 'none'} | "${e.title}"`
        ).join('\n');

        const personaSummary = await getPersonaSummary();

        // 4. Run AI analysis
        console.log('[Cron] Running Body-Mind Bridge AI analysis...');
        const resultStr = await analyzeBodyMindCorrelations(entriesText, personaSummary);
        const result = JSON.parse(resultStr);
        const correlations = result.correlations || [];

        // 5. Store correlations as insights
        let createdCount = 0;
        for (const corr of correlations) {
            // Check for similar existing insight
            const { data: existing } = await supabase
                .from('insights')
                .select('id')
                .ilike('insight_text', `%${corr.physical}%`)
                .eq('type', 'body_mind')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

            if (!existing || existing.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: `🧠↔️🏃 Body-Mind: ${corr.pattern}\n\n💡 ${corr.recommendation}`,
                    type: 'body_mind',
                    confidence: corr.confidence || 0.7,
                    status: 'new',
                });
                createdCount++;
            }
        }

        // 6. Store summary insight
        if (result.body_summary) {
            await supabase.from('insights').insert({
                insight_text: `Body-Mind Summary (30d): ${result.body_summary}`,
                type: 'body_mind',
                confidence: 0.9,
                status: 'new',
            });
        }

        console.log(`[Cron] Body-Mind Bridge: ${createdCount} correlation insights created.`);
        await completeCronRun(runId, 'completed', {
            entries_analyzed: entries.length,
            with_body_signals: withBodySignals.length,
            correlations_found: correlations.length,
            insights_created: createdCount,
        }, undefined, entries.length);

        return NextResponse.json({
            success: true,
            correlations: correlations.length,
            insights_created: createdCount,
        });

    } catch (error) {
        console.error('[Cron] Body-Mind Bridge failed:', error);
        await completeCronRun(runId, 'failed', {}, error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
