// ============================================================
// INNER SELF — Data Cleanup API (Cron Route)
// ============================================================
// This route can be called periodically (e.g., via Vercel Cron)
// to automatically clean up duplicates across all tables.
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
    try {
        const supabase = getServiceSupabase();
        const results: Record<string, number> = {};

        // 1. Dedup life events by title (case-insensitive, keep newest)
        const { data: events } = await supabase
            .from('life_events_timeline')
            .select('id, title, created_at')
            .order('created_at', { ascending: false });

        if (events && events.length > 0) {
            const seen = new Map<string, string>();
            const dupeIds: string[] = [];
            for (const e of events) {
                const key = (e.title || '').toLowerCase().trim();
                if (seen.has(key)) {
                    dupeIds.push(e.id);
                } else {
                    seen.set(key, e.id);
                }
            }
            if (dupeIds.length > 0) {
                await supabase.from('life_events_timeline').delete().in('id', dupeIds);
            }
            results.life_events_removed = dupeIds.length;
        }

        // 2. Dedup people by name (case-insensitive, merge counts, keep newest)
        const { data: people } = await supabase
            .from('people_map')
            .select('*')
            .order('last_mentioned', { ascending: false });

        if (people && people.length > 0) {
            const seen = new Map<string, string>();
            const dupeIds: string[] = [];
            for (const p of people) {
                const key = (p.name || '').toLowerCase().trim();
                if (seen.has(key)) {
                    const keptId = seen.get(key)!;
                    const kept = people.find(x => x.id === keptId);
                    if (kept) {
                        await supabase.from('people_map').update({
                            mention_count: (kept.mention_count || 0) + (p.mention_count || 0),
                        }).eq('id', keptId);
                    }
                    dupeIds.push(p.id);
                } else {
                    seen.set(key, p.id);
                }
            }
            if (dupeIds.length > 0) {
                await supabase.from('people_map').delete().in('id', dupeIds);
            }
            results.people_removed = dupeIds.length;
        }

        // 3. Dedup extracted entities (same title + category)
        const { data: entities } = await supabase
            .from('extracted_entities')
            .select('id, title, category, created_at')
            .order('created_at', { ascending: false });

        if (entities && entities.length > 0) {
            const seen = new Map<string, string>();
            const dupeIds: string[] = [];
            for (const e of entities) {
                const key = (e.title || '').toLowerCase().trim() + '|' + (e.category || '');
                if (seen.has(key)) {
                    dupeIds.push(e.id);
                } else {
                    seen.set(key, e.id);
                }
            }
            if (dupeIds.length > 0) {
                await supabase.from('extracted_entities').delete().in('id', dupeIds);
            }
            results.entities_removed = dupeIds.length;
        }

        // 4. Dedup raw entries (exact same text, keep newest)
        const { data: rawEntries } = await supabase
            .from('raw_entries')
            .select('id, raw_text, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (rawEntries && rawEntries.length > 0) {
            const seen = new Map<string, string>();
            const dupeIds: string[] = [];
            for (const r of rawEntries) {
                const key = (r.raw_text || '').trim();
                if (seen.has(key)) {
                    dupeIds.push(r.id);
                } else {
                    seen.set(key, r.id);
                }
            }
            if (dupeIds.length > 0) {
                await supabase.from('extracted_entities').delete().in('entry_id', dupeIds);
                await supabase.from('raw_entries').delete().in('id', dupeIds);
            }
            results.raw_entries_removed = dupeIds.length;
        }

        // 5. Dedup insights (exact same text)
        const { data: insights } = await supabase
            .from('insights')
            .select('id, insight_text, created_at')
            .order('created_at', { ascending: false });

        if (insights && insights.length > 0) {
            const seen = new Map<string, string>();
            const dupeIds: string[] = [];
            for (const i of insights) {
                const key = (i.insight_text || '').trim();
                if (seen.has(key)) {
                    dupeIds.push(i.id);
                } else {
                    seen.set(key, i.id);
                }
            }
            if (dupeIds.length > 0) {
                await supabase.from('insights').delete().in('id', dupeIds);
            }
            results.insights_removed = dupeIds.length;
        }

        // 6. Remove orphaned entities (no matching raw entry)
        if (entities && rawEntries) {
            const rawIds = new Set(rawEntries.map(r => r.id));
            const orphanIds = entities.filter(e => {
                const entryIdField = (e as Record<string, unknown>)['entry_id'] as string | undefined;
                return entryIdField && !rawIds.has(entryIdField);
            }).map(e => e.id);
            if (orphanIds.length > 0) {
                await supabase.from('extracted_entities').delete().in('id', orphanIds);
            }
            results.orphaned_entities_removed = orphanIds.length;
        }

        const totalRemoved = Object.values(results).reduce((a, b) => a + b, 0);
        console.log(`[Cleanup] Removed ${totalRemoved} duplicates:`, results);

        return NextResponse.json({
            success: true,
            removed: results,
            total_removed: totalRemoved,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Cleanup error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Cleanup failed' },
            { status: 500 }
        );
    }
}
