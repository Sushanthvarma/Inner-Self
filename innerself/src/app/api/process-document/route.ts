
import { NextRequest, NextResponse } from 'next/server';
import { processDocumentContent } from '@/lib/ai';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// BUG 7: Validate date strings — catches 'null', 'unknown', 'N/A', empty, etc.
function validateDate(raw: string | null | undefined): string {
    if (!raw) return new Date().toISOString().split('T')[0];
    const s = raw.trim().toLowerCase();
    if (['null', 'unknown', 'n/a', 'na', 'none', 'undefined', ''].includes(s)) {
        return new Date().toISOString().split('T')[0];
    }
    // Check it's a plausible date format (YYYY-MM-DD or similar)
    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
        return raw.trim().substring(0, 10);
    }
    // Try parsing it
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { docId } = body;

        if (!docId) {
            return NextResponse.json({ error: 'No docId provided' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // 1. Fetch the document text from DB
        const { data: doc, error: fetchError } = await supabase
            .from('uploaded_documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (fetchError || !doc) {
            console.error('Fetch error:', fetchError);
            return NextResponse.json({ error: 'Document not found' }, { status: 404 });
        }

        // BUG 5: REMOVED "Already processed" early return — allow re-processing
        // Reset status to pending so we can reprocess
        if (doc.processing_status === 'completed') {
            console.log(`[ProcessDoc] Re-processing previously completed doc ${docId}`);
            await supabase.from('uploaded_documents').update({
                processing_status: 'pending',
            }).eq('id', docId);
        }

        if (!doc.extracted_text) {
            return NextResponse.json({ error: 'No content to process' }, { status: 400 });
        }

        // 2. Call AI
        console.log(`Processing doc ${docId} with Claude...`);
        const result = await processDocumentContent(doc.extracted_text, doc.file_type, doc.file_name);

        let parsed;
        try {
            parsed = JSON.parse(result);
        } catch (e) {
            console.error('Failed to parse AI JSON:', result);
            throw new Error('AI returned invalid JSON');
        }

        // 3. Update DB with Persona/People/Events overrides

        // Update user_persona_summary
        if (parsed.persona_updates) {
            const { data: existing } = await supabase
                .from('user_persona_summary')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (existing) {
                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (parsed.persona_updates.active_goals) {
                    const existingGoals = (existing.active_goals as unknown[]) || [];
                    updates.active_goals = [...existingGoals, ...parsed.persona_updates.active_goals];
                }
                if (parsed.persona_updates.full_psychological_profile) {
                    updates.full_psychological_profile =
                        (existing.full_psychological_profile || '') + '\n\n[Updated from: ' + doc.file_name + ']\n' +
                        parsed.persona_updates.full_psychological_profile;
                }

                const { error: updateError } = await supabase.from('user_persona_summary').update(updates).eq('id', existing.id);
                if (updateError) console.error('Persona update error:', updateError);
            } else {
                const { error: insertError } = await supabase.from('user_persona_summary').insert({
                    id: uuidv4(),
                    ...parsed.persona_updates,
                });
                if (insertError) console.error('Persona insert error:', insertError);
            }
        }

        // People
        if (parsed.people && parsed.people.length > 0) {
            const now = new Date().toISOString();
            for (const p of parsed.people) {
                const { data: existingPerson } = await supabase
                    .from('people_map')
                    .select('*')
                    .ilike('name', p.name)
                    .single();

                if (existingPerson) {
                    const { error } = await supabase.from('people_map').update({
                        last_mentioned: now,
                        mention_count: (existingPerson.mention_count || 0) + 1,
                    }).eq('id', existingPerson.id);
                    if (error) console.error(`Error updating person ${p.name}:`, error);
                } else {
                    const { error } = await supabase.from('people_map').insert({
                        id: uuidv4(),
                        name: p.name,
                        relationship: p.relationship,
                        first_mentioned: now,
                        last_mentioned: now,
                        mention_count: 1,
                        sentiment_avg: p.sentiment_avg,
                        tags: p.tags || [],
                        sentiment_history: [
                            { date: now, sentiment: p.sentiment_avg, context: `doc: ${doc.file_name}` },
                        ],
                    });
                    if (error) console.error(`Error inserting person ${p.name}:`, error);
                }
            }
        }

        // Life Events — with dedup by docId
        if (parsed.life_events && parsed.life_events.length > 0) {
            const { error: deleteError } = await supabase
                .from('life_events_timeline')
                .delete()
                .contains('source_entry_ids', [docId]);

            if (deleteError) console.error('Error cleaning up old events:', deleteError);

            const eventRows = parsed.life_events.map(
                (e: { title: string; description: string; significance: number; category: string; emotions: string[]; event_date?: string }) => ({
                    id: uuidv4(),
                    event_date: validateDate(e.event_date),
                    title: e.title,
                    description: e.description,
                    significance: e.significance || 5,
                    category: e.category || 'personal',
                    emotions: e.emotions || [],
                    source_entry_ids: [docId],
                })
            );

            const { error: eventsError } = await supabase.from('life_events_timeline').insert(eventRows);
            if (eventsError) {
                console.error('Error inserting life events:', eventsError);
                throw new Error(`Failed to insert life events: ${eventsError.message}`);
            }
        }

        // BUG 1: Health Metrics — DELETE old metrics from this doc FIRST, then insert
        if (parsed.health_metrics && parsed.health_metrics.length > 0) {
            // Step 1: Delete all existing metrics from this document (same pattern as life_events)
            const { error: deleteMetricsError } = await supabase
                .from('health_metrics')
                .delete()
                .eq('source_doc_id', docId);

            if (deleteMetricsError) {
                console.error('Error cleaning up old health metrics:', deleteMetricsError);
            }

            // Step 2: Also dedup by metric_name + measured_at across all docs
            for (const m of parsed.health_metrics) {
                const measuredAt = validateDate(m.date);
                const { error: crossDedup } = await supabase
                    .from('health_metrics')
                    .delete()
                    .eq('metric_name', m.metric)
                    .eq('measured_at', measuredAt);
                if (crossDedup) console.error('Cross-doc dedup error:', crossDedup);
            }

            // Step 3: Insert fresh metrics
            const metricsRows = parsed.health_metrics.map((m: any) => ({
                id: uuidv4(),
                metric_name: m.metric,
                value: String(m.value),
                unit: m.unit,
                status: m.status,
                measured_at: validateDate(m.date),
                source_doc_id: docId
            }));

            // BUG 5: Make health_metrics errors THROW instead of silent console.error
            const { error: metricsError } = await supabase.from('health_metrics').insert(metricsRows);
            if (metricsError) {
                console.error('Error inserting health metrics:', metricsError.message);
                throw new Error(`Failed to insert health metrics: ${metricsError.message}`);
            }
            console.log(`[ProcessDoc] Inserted ${metricsRows.length} health metrics for doc ${docId}`);
        }

        // Insights
        if (parsed.insights && parsed.insights.length > 0) {
            const insightRows = parsed.insights.map((text: string) => ({
                id: uuidv4(),
                insight_text: text,
                type: 'document_upload',
            }));

            const { error: insightsError } = await supabase.from('insights').insert(insightRows);
            if (insightsError) console.error('Error inserting insights:', insightsError);
        }

        // 4. Mark Doc Completed
        const metricsCount = parsed.health_metrics?.length || 0;
        const { error: completeError } = await supabase.from('uploaded_documents').update({
            processing_status: 'completed',
            insights_generated: {
                people_count: parsed.people?.length || 0,
                events_count: parsed.life_events?.length || 0,
                metrics_count: metricsCount,
                insights_count: parsed.insights?.length || 0,
            },
        }).eq('id', docId);

        if (completeError) {
            console.error('Error completing doc status:', completeError);
            throw completeError;
        }

        return NextResponse.json({
            success: true,
            peopleFound: parsed.people?.length || 0,
            eventsFound: parsed.life_events?.length || 0,
            metricsFound: metricsCount,
            insightsGenerated: parsed.insights?.length || 0,
        });

    } catch (error: any) {
        console.error('Process API error:', error);

        try {
            const supabase = getServiceSupabase();
            const { docId } = await request.clone().json().catch(() => ({}));
            if (docId) {
                await supabase.from('uploaded_documents').update({
                    processing_status: 'failed',
                    insights_generated: { error: error.message }
                }).eq('id', docId);
            }
        } catch (e) { /* ignore */ }

        return NextResponse.json({ error: error.message || 'Processing failed' }, { status: 500 });
    }
}
