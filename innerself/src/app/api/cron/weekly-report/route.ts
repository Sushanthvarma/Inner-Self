// ============================================================
// INNER SELF — Weekly Report Cron
// Generates weekly summary (Sun-Sat) and stores it
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateWeeklyReport, generateBiography } from '@/lib/ai';
import { getPersonaSummary } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
    try {
        console.log('[Cron] Starting weekly report generation...');
        const supabase = getServiceSupabase();

        // 1. Determine the week range (last complete week, Mon-Sun or Sun-Sat?)
        // Let's assume this runs on Sunday late night (23:00) covering the last 7 days including today.
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const startDateStr = weekStart.toISOString().split('T')[0];
        const endDateStr = weekEnd.toISOString().split('T')[0];

        // Check if report already exists for this week
        const { data: existing } = await supabase
            .from('weekly_reports')
            .select('id')
            .eq('week_start_date', startDateStr)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`[Cron] Report for ${startDateStr} already exists. Skipping.`);
            return NextResponse.json({ message: 'Report already exists' });
        }

        // 2. Fetch data
        const { data: entries, error } = await supabase
            .from('extracted_entities')
            .select('title, content, mood_score, category, created_at, task_status')
            .gte('created_at', weekStart.toISOString())
            .lte('created_at', weekEnd.toISOString())
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!entries || entries.length < 5) {
            console.log('[Cron] Not enough entries (<5) to generate meaningful report.');
            return NextResponse.json({ message: 'Insufficient data' });
        }

        const entriesText = entries.map(e =>
            `[${e.category}] ${e.title} (Mood: ${e.mood_score}/10) ${e.task_status ? `[Task: ${e.task_status}]` : ''}`
        ).join('\n');

        // 3. Get previous report for continuity
        const { data: lastReport } = await supabase
            .from('weekly_reports')
            .select('report_json')
            .lt('week_start_date', startDateStr)
            .order('week_start_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        const previousReportText = lastReport ? JSON.stringify(lastReport.report_json) : '';
        const personaSummary = await getPersonaSummary();

        // 4. Generate report
        console.log(`[Cron] Generating report for ${entries.length} entries...`);
        const reportJsonStr = await generateWeeklyReport(entriesText, personaSummary, previousReportText);
        const reportJson = JSON.parse(reportJsonStr);

        // 5. Store report
        const { data: inserted, error: insertError } = await supabase
            .from('weekly_reports')
            .insert({
                week_start_date: startDateStr,
                week_end_date: endDateStr,
                report_json: reportJson,
                is_read: false
            })
            .select()
            .single();

        if (insertError) throw insertError;

        console.log(`[Cron] Weekly report generated: ID ${inserted.id}`);

        // 6. Create a notification insight
        await supabase.from('insights').insert({
            insight_text: `Weekly Report Ready: Your review for ${startDateStr} to ${endDateStr} is available.`,
            type: 'observation',
            confidence: 1.0,
            status: 'new',
            related_entry_ids: []
        });

        // 7. Auto-Update Biography
        console.log('[Cron] Updating Biography...');
        try {
            // Fetch data for biography
            const [personaResult, peopleResult, eventsResult] = await Promise.all([
                supabase.from('user_persona_summary').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
                supabase.from('people_map').select('name, relationship, mention_count, sentiment_avg').order('mention_count', { ascending: false }),
                supabase.from('life_events_timeline').select('title, description, category, significance, event_date').order('event_date', { ascending: false }),
            ]);

            const { data: recentEntries } = await supabase
                .from('extracted_entities')
                .select('title, content, category, mood_score, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            const biographyText = await generateBiography({
                persona: personaResult.data || null,
                entries: recentEntries || [],
                people: peopleResult.data || [],
                lifeEvents: eventsResult.data || [],
            });

            // Update or create persona summary with new bio
            const now = new Date().toISOString();
            if (personaResult.data) {
                await supabase.from('user_persona_summary').update({
                    biography_narrative: biographyText,
                    biography_generated_at: now,
                    updated_at: now,
                }).eq('id', personaResult.data.id);
                console.log('[Cron] Biography updated successfully.');
            } else {
                const { v4: uuidv4 } = await import('uuid');
                await supabase.from('user_persona_summary').insert({
                    id: uuidv4(),
                    updated_at: now,
                    biography_narrative: biographyText,
                    biography_generated_at: now,
                });
                console.log('[Cron] Biography created (new persona row).');
            }
        } catch (bioError) {
            console.error('[Cron] Failed to update biography:', bioError);
            // Don't fail the whole request
        }

        return NextResponse.json({ success: true, report_id: inserted.id });

    } catch (error) {
        console.error('[Cron] Weekly report generation failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
