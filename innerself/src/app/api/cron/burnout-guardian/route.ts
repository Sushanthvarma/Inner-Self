// ============================================================
// INNER SELF — Burnout Guardian Cron
// Monitors 7-day energy average. Alerts if < 4/10.
// Runs daily at 2 AM.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { verifyCronAuth, startCronRun, completeCronRun } from '@/lib/cron-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const runId = await startCronRun('burnout_guardian');

    try {
        console.log('[Cron] Starting Burnout Guardian...');
        const supabase = getServiceSupabase();

        // 1. Fetch energy_level from last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('energy_level, mood_score, created_at')
            .gte('created_at', sevenDaysAgo.toISOString())
            .not('energy_level', 'is', null);

        if (error) throw error;

        if (!entries || entries.length < 3) {
            console.log('[Cron] Not enough entries (<3) for burnout detection.');
            await completeCronRun(runId, 'completed', { message: 'Insufficient data', entries: entries?.length || 0 });
            return NextResponse.json({ message: 'Insufficient data' });
        }

        // 2. Calculate averages
        const energyValues = entries.map(e => e.energy_level).filter((v): v is number => v != null);
        const moodValues = entries.map(e => e.mood_score).filter((v): v is number => v != null);

        const avgEnergy = energyValues.reduce((a, b) => a + b, 0) / energyValues.length;
        const avgMood = moodValues.reduce((a, b) => a + b, 0) / (moodValues.length || 1);

        // 3. Check for consecutive low energy days
        const sortedByDate = entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        let consecutiveLow = 0;
        let maxConsecutiveLow = 0;
        for (const e of sortedByDate) {
            if (e.energy_level && e.energy_level <= 4) {
                consecutiveLow++;
                maxConsecutiveLow = Math.max(maxConsecutiveLow, consecutiveLow);
            } else {
                consecutiveLow = 0;
            }
        }

        console.log(`[Cron] Burnout check: avg_energy=${avgEnergy.toFixed(1)}, avg_mood=${avgMood.toFixed(1)}, max_consec_low=${maxConsecutiveLow}`);

        // 4. Determine alert level
        let alertLevel: 'none' | 'warning' | 'critical' = 'none';
        let alertMessage = '';

        if (avgEnergy < 3.0 || maxConsecutiveLow >= 5) {
            alertLevel = 'critical';
            alertMessage = `🚨 BURNOUT ALERT (Critical): Your average energy is ${avgEnergy.toFixed(1)}/10 over the past 7 days (${energyValues.length} entries). ${maxConsecutiveLow >= 5 ? `You've had ${maxConsecutiveLow} consecutive low-energy entries.` : ''} This is a clear signal your body and mind need rest. Consider: cancelling non-essential commitments, sleeping 8+ hours tonight, and doing something purely enjoyable tomorrow.`;
        } else if (avgEnergy < 4.0 || maxConsecutiveLow >= 3) {
            alertLevel = 'warning';
            alertMessage = `⚠️ Energy Warning: Your 7-day average energy is ${avgEnergy.toFixed(1)}/10 (${energyValues.length} entries). ${maxConsecutiveLow >= 3 ? `${maxConsecutiveLow} consecutive low-energy periods detected.` : ''} You're running low. Prioritize recovery before it escalates. Even a 20-minute walk or a proper lunch break helps.`;
        }

        // 5. Create insight if alert triggered
        if (alertLevel !== 'none') {
            // Check if we already warned today
            const { data: existingWarning } = await supabase
                .from('insights')
                .select('id')
                .eq('type', 'warning')
                .ilike('insight_text', '%energy%')
                .gte('created_at', new Date().toISOString().split('T')[0])
                .limit(1);

            if (!existingWarning || existingWarning.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: alertMessage,
                    type: 'warning',
                    confidence: alertLevel === 'critical' ? 1.0 : 0.8,
                    status: 'new',
                });
                console.log(`[Cron] Burnout ${alertLevel} alert created.`);
            }
        }

        const result = {
            avg_energy: parseFloat(avgEnergy.toFixed(1)),
            avg_mood: parseFloat(avgMood.toFixed(1)),
            entries_analyzed: energyValues.length,
            max_consecutive_low: maxConsecutiveLow,
            alert_level: alertLevel,
        };

        await completeCronRun(runId, 'completed', result, undefined, energyValues.length);

        return NextResponse.json({ success: true, ...result });

    } catch (error) {
        console.error('[Cron] Burnout Guardian failed:', error);
        await completeCronRun(runId, 'failed', {}, error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
