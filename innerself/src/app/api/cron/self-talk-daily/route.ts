// ============================================================
// INNER SELF — Daily Self-Talk Analysis Cron
// Aggregates self-talk tones from the last 24h/30d
// Triggers alert if critical self-talk > 70%
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Cron] Starting self-talk daily analysis...');
        const supabase = getServiceSupabase();

        // 1. Get all entries from the last 24 hours to check for immediate spikes
        // and last 30 days for the rolling average (which is what we store)
        // Actually, the spec says "Aggregate self_talk_tone from last 30 days" for the daily score.

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('self_talk_tone, created_at')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .not('self_talk_tone', 'is', null);

        if (error) throw error;

        if (!entries || entries.length === 0) {
            console.log('[Cron] No entries with self-talk tone found in last 30 days.');
            return NextResponse.json({ message: 'No data to analyze' });
        }

        // 2. Calculate percentages
        let positive = 0;
        let neutral = 0;
        let critical = 0;
        const total = entries.length;

        entries.forEach(e => {
            if (e.self_talk_tone === 'compassionate') positive++;
            else if (e.self_talk_tone === 'critical') critical++;
            else neutral++; // neutral or others
        });

        const positivePct = parseFloat(((positive / total) * 100).toFixed(1));
        const neutralPct = parseFloat(((neutral / total) * 100).toFixed(1));
        const criticalPct = parseFloat(((critical / total) * 100).toFixed(1));

        console.log(`[Cron] Self-talk (30d): +${positivePct}% / =${neutralPct}% / -${criticalPct}%`);

        // 3. Store in self_talk_daily
        const today = new Date().toISOString().split('T')[0];
        const alertTriggered = criticalPct > 70;

        const { error: upsertError } = await supabase
            .from('self_talk_daily')
            .upsert({
                date: today,
                positive_pct: positivePct,
                neutral_pct: neutralPct,
                critical_pct: criticalPct,
                total_entries: total,
                alert_triggered: alertTriggered
            }, { onConflict: 'date' });

        if (upsertError) throw upsertError;

        // 4. If alert triggered, create a warning insight
        if (alertTriggered) {
            // Check if we already created a warning today to avoid spam
            const { data: existingWarning } = await supabase
                .from('insights')
                .select('id')
                .eq('type', 'warning')
                .ilike('insight_text', '%critical self-talk%')
                .gte('created_at', new Date().setHours(0, 0, 0, 0) as unknown as string) // approximate check
                .limit(1);

            if (!existingWarning || existingWarning.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: `⚠️ Critical Self-Talk Alert: Your inner critic has been active in ${criticalPct}% of recent entries. Be gentle with yourself today.`,
                    type: 'warning',
                    confidence: 1.0,
                    status: 'new'
                });
                console.log('[Cron] Critical alert triggered and insight created.');
            }
        }

        return NextResponse.json({
            success: true,
            date: today,
            stats: { positivePct, neutralPct, criticalPct, total },
            alert: alertTriggered
        });

    } catch (error) {
        console.error('[Cron] Self-talk analysis failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
