// ============================================================
// INNER SELF — Health Insights API
// Generates AI-powered health comparison & recommendations
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateHealthInsights } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { grouped_metrics, flaggedCount, normalCount, totalCount } = body;

        if (!grouped_metrics || totalCount === 0) {
            return NextResponse.json({ error: 'No metrics data provided' }, { status: 400 });
        }

        console.log(`[HealthInsights] Generating insights for ${totalCount} metrics...`);

        const result = await generateHealthInsights({
            grouped: grouped_metrics,
            flaggedCount: flaggedCount || 0,
            normalCount: normalCount || 0,
            totalCount: totalCount || 0,
        });

        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch {
            console.error('[HealthInsights] Failed to parse AI JSON:', result.substring(0, 200));
            return NextResponse.json({ error: 'AI returned invalid response' }, { status: 500 });
        }

        // Store the insights in DB for caching
        const supabase = getServiceSupabase();
        const { error: storeError } = await supabase
            .from('insights')
            .insert({
                id: crypto.randomUUID(),
                insight_text: JSON.stringify(parsed),
                type: 'health_analysis',
            });
        if (storeError) console.error('[HealthInsights] Failed to store insight:', storeError);

        return NextResponse.json({
            success: true,
            insights: parsed,
        });

    } catch (error: any) {
        console.error('[HealthInsights] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate insights' },
            { status: 500 }
        );
    }
}

// GET: Fetch last cached health insight
export async function GET() {
    try {
        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('insights')
            .select('*')
            .eq('type', 'health_analysis')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            return NextResponse.json({ success: true, insights: null });
        }

        let parsed;
        try {
            parsed = JSON.parse(data.insight_text);
        } catch {
            return NextResponse.json({ success: true, insights: null });
        }

        return NextResponse.json({
            success: true,
            insights: parsed,
            generated_at: data.created_at,
        });
    } catch (error) {
        console.error('[HealthInsights] GET error:', error);
        return NextResponse.json({ success: true, insights: null });
    }
}
