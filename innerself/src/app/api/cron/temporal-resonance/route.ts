// ============================================================
// INNER SELF — Temporal Resonance Cron
// Detects life event anniversaries (+/- 3 days) and creates
// warm check-in insights. Runs daily at 2 AM.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { detectTemporalResonance } from '@/lib/ai';
import { verifyCronAuth, startCronRun, completeCronRun } from '@/lib/cron-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const authError = verifyCronAuth(request);
    if (authError) return authError;

    const runId = await startCronRun('temporal_resonance');

    try {
        console.log('[Cron] Starting Temporal Resonance (anniversary detection)...');
        const supabase = getServiceSupabase();

        // 1. Fetch all life events with dates
        const { data: events, error } = await supabase
            .from('life_events_timeline')
            .select('title, event_date, category, significance, description')
            .not('event_date', 'is', null)
            .order('event_date', { ascending: true });

        if (error) throw error;

        if (!events || events.length === 0) {
            console.log('[Cron] No life events with dates found.');
            await completeCronRun(runId, 'completed', { message: 'No events to check' });
            return NextResponse.json({ message: 'No events to check' });
        }

        // 2. Check for anniversaries
        const today = new Date().toISOString().split('T')[0];
        console.log(`[Cron] Checking ${events.length} events against today (${today})...`);

        const result = await detectTemporalResonance(today, events);
        const parsed = JSON.parse(result);
        const resonances = parsed.resonances || [];

        if (resonances.length === 0) {
            console.log('[Cron] No anniversaries found today.');
            await completeCronRun(runId, 'completed', { events_checked: events.length, resonances: 0 });
            return NextResponse.json({ success: true, resonances: 0 });
        }

        // 3. Create insights for each resonance
        let createdCount = 0;
        for (const res of resonances) {
            // Check if we already created this resonance insight today
            const { data: existing } = await supabase
                .from('insights')
                .select('id')
                .ilike('insight_text', `%${res.event_title}%`)
                .eq('type', 'anniversary')
                .gte('created_at', new Date().toISOString().split('T')[0])
                .limit(1);

            if (!existing || existing.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: `🕰️ ${res.years_ago} year${res.years_ago > 1 ? 's' : ''} ago: ${res.event_title}. ${res.reflection}`,
                    type: 'anniversary',
                    confidence: 1.0,
                    status: 'new',
                });
                createdCount++;
            }
        }

        console.log(`[Cron] Temporal Resonance: ${createdCount} anniversary insights created.`);
        await completeCronRun(runId, 'completed', {
            events_checked: events.length,
            resonances_found: resonances.length,
            insights_created: createdCount,
        }, undefined, events.length);

        return NextResponse.json({
            success: true,
            resonances: resonances.length,
            insights_created: createdCount,
        });

    } catch (error) {
        console.error('[Cron] Temporal Resonance failed:', error);
        await completeCronRun(runId, 'failed', {}, error instanceof Error ? error.message : 'Unknown');
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
