// ============================================================
// INNER SELF — Health Metrics API
// Returns health data for the dashboard
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = getServiceSupabase();

        // Fetch all metrics suitable for graphing (numeric values)
        // We'll filter non-numeric in JS or try to cast in SQL if possible, but JS is safer
        const { data: metrics, error } = await supabase
            .from('health_metrics')
            .select('*')
            .order('measured_at', { ascending: true });

        if (error) {
            // Table might not exist yet
            return NextResponse.json({ metrics: [] });
        }

        // Group by metric name
        const grouped: Record<string, any[]> = {};

        metrics.forEach((m: any) => {
            if (!grouped[m.metric_name]) {
                grouped[m.metric_name] = [];
            }
            // Try to parse value as float
            const val = parseFloat(m.value);
            if (!isNaN(val)) {
                grouped[m.metric_name].push({
                    date: m.measured_at,
                    value: val,
                    unit: m.unit,
                    id: m.id
                });
            }
        });

        // Sort each group by date (already sorted by query but good to ensure)
        // And maybe limit to last 30 readings?

        return NextResponse.json({
            success: true,
            grouped_metrics: grouped
        });

    } catch (error) {
        console.error('Health metrics API error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
