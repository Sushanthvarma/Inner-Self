// ============================================================
// INNER SELF — Health Metrics API
// Returns health data for the dashboard + delete handlers
// BUG 4: Dedup + filter  |  BUG 6: DELETE handler
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = getServiceSupabase();
        const { searchParams } = new URL(request.url);

        // BUG 4(b): Optional source filter — ?source=doc or ?source=entry
        const source = searchParams.get('source');

        let query = supabase
            .from('health_metrics')
            .select('*')
            .order('measured_at', { ascending: true });

        if (source === 'doc') {
            query = query.not('source_doc_id', 'is', null);
        } else if (source === 'entry') {
            query = query.not('source_entry_id', 'is', null);
        }

        const { data: metrics, error } = await query;

        if (error) {
            return NextResponse.json({ metrics: [] });
        }

        // BUG 4(a): Client-side dedup by metric_name + measured_at — keep newest (latest created_at)
        const dedupMap = new Map<string, any>();
        for (const m of (metrics || [])) {
            const key = `${m.metric_name}::${m.measured_at}`;
            const existing = dedupMap.get(key);
            if (!existing || new Date(m.created_at) > new Date(existing.created_at)) {
                dedupMap.set(key, m);
            }
        }

        const dedupedMetrics = Array.from(dedupMap.values());

        // Group by metric name
        const grouped: Record<string, any[]> = {};

        dedupedMetrics.forEach((m: any) => {
            if (!grouped[m.metric_name]) {
                grouped[m.metric_name] = [];
            }
            const val = parseFloat(m.value);
            if (!isNaN(val)) {
                grouped[m.metric_name].push({
                    date: m.measured_at,
                    value: val,
                    unit: m.unit,
                    status: m.status,
                    id: m.id,
                    source_doc_id: m.source_doc_id,
                });
            }
        });

        // Sort each group by date
        for (const key of Object.keys(grouped)) {
            grouped[key].sort((a: any, b: any) => a.date.localeCompare(b.date));
        }

        return NextResponse.json({
            success: true,
            grouped_metrics: grouped,
            total_raw: metrics?.length || 0,
            total_deduped: dedupedMetrics.length,
        });

    } catch (error) {
        console.error('Health metrics API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

// BUG 6: DELETE handler — supports ?id=X (single metric) or ?doc_id=X (all from doc) or ?all=true
export async function DELETE(request: NextRequest) {
    try {
        const supabase = getServiceSupabase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const docId = searchParams.get('doc_id');
        const all = searchParams.get('all');

        if (!id && !docId && all !== 'true') {
            return NextResponse.json(
                { error: 'Provide ?id=X, ?doc_id=X, or ?all=true' },
                { status: 400 }
            );
        }

        let deleted = 0;

        if (all === 'true') {
            // Delete ALL health metrics
            const { data, error } = await supabase
                .from('health_metrics')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000') // Supabase needs a WHERE clause
                .select('id');
            if (error) throw error;
            deleted = data?.length || 0;
        } else if (id) {
            const { data, error } = await supabase
                .from('health_metrics')
                .delete()
                .eq('id', id)
                .select('id');
            if (error) throw error;
            deleted = data?.length || 0;
        } else if (docId) {
            const { data, error } = await supabase
                .from('health_metrics')
                .delete()
                .eq('source_doc_id', docId)
                .select('id');
            if (error) throw error;
            deleted = data?.length || 0;
        }

        return NextResponse.json({ success: true, deleted });

    } catch (error) {
        console.error('Health metrics DELETE error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Delete failed' },
            { status: 500 }
        );
    }
}
