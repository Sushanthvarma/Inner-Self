// ============================================================
// INNER SELF — Void Mapper Cron (Topic Decay)
// Detects active goals or patterns that haven't been mentioned in 14 days
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { detectVoidTopics } from '@/lib/ai';
import { getPersonaSummary } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Cron] Starting Void Mapper (Topic Decay detection)...');
        const supabase = getServiceSupabase();

        // 1. Get Persona Summary (Active Goals & Patterns)
        const summaryJson = await getPersonaSummary();
        let summary;
        try {
            summary = JSON.parse(summaryJson);
        } catch {
            summary = {};
        }

        const activeGoals = summary.active_goals?.map((g: any) => g.goal || g) || [];
        const recurringPatterns = summary.recurring_patterns || [];

        if (activeGoals.length === 0 && recurringPatterns.length === 0) {
            console.log('[Cron] No active goals or patterns to check.');
            return NextResponse.json({ message: 'No targets to check' });
        }

        // 2. Get last 14 days of entries
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('title, content, category, created_at')
            .gte('created_at', fourteenDaysAgo.toISOString());

        if (error) throw error;

        if (!entries || entries.length === 0) {
            console.log('[Cron] No entries in last 14 days. Void detection skipped (all is void).');
            return NextResponse.json({ message: 'No recent activity' });
        }

        const recentText = entries.map(e => `[${e.created_at.split('T')[0]}] ${e.title}: ${e.content}`).join('\n');

        // 3. Detect Void Topics via AI
        console.log(`[Cron] Checking ${activeGoals.length} goals and ${recurringPatterns.length} patterns against ${entries.length} entries...`);
        const result = await detectVoidTopics(recentText, activeGoals, recurringPatterns);

        if (!result.decaying_topics || result.decaying_topics.length === 0) {
            console.log('[Cron] No void topics detected.');
            return NextResponse.json({ success: true, void_count: 0 });
        }

        // 4. Create Insights for decaying topics
        let createdCount = 0;
        for (const topic of result.decaying_topics) {
            // Check if we already warned about this topic in the last 7 days
            const { data: existing } = await supabase
                .from('insights')
                .select('id')
                .ilike('insight_text', `%${topic.topic}%`)
                .eq('type', 'warning') // Void is usually a warning
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

            if (!existing || existing.length === 0) {
                await supabase.from('insights').insert({
                    insight_text: `void_detected: You haven't mentioned "${topic.topic}" in over 14 days. ${topic.reason}`,
                    type: 'warning', // or 'pattern'
                    confidence: 0.9,
                    status: 'new'
                });
                createdCount++;
            }
        }

        console.log(`[Cron] Void Mapper finished. flagged ${createdCount} decaying topics.`);

        return NextResponse.json({
            success: true,
            void_topics: result.decaying_topics.length,
            insights_created: createdCount
        });

    } catch (error) {
        console.error('[Cron] Void Mapper failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
