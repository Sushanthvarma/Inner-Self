
import { NextRequest, NextResponse } from 'next/server';
import { processDocumentContent } from '@/lib/ai';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Try to use max duration if allowed

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

        if (doc.processing_status === 'completed') {
            return NextResponse.json({ success: true, message: 'Already processed' });
        }

        if (!doc.extracted_text) {
            return NextResponse.json({ error: 'No content to process' }, { status: 400 });
        }

        // 2. Call AI
        console.log(`Processing doc ${docId} with Gemini...`);
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
                if (updateError) console.error('Persona update error:', updateError); // Log but don't fail whole process?
            } else {
                // If no persona exists, create one (partial)
                const { error: insertError } = await supabase.from('user_persona_summary').insert({
                    id: uuidv4(),
                    ...parsed.persona_updates, // This might fail if mandatory fields are missing? But schema usually allows nulls except updated_at
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
                    .eq('name', p.name)
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

        // Life Events
        if (parsed.life_events && parsed.life_events.length > 0) {
            // Deduplicate: Delete existing events linked to this docId
            // Note: If an event has multiple source_ids, this might be aggressive, 
            // but for now 1 doc = 1 set of events is safer.
            const { error: deleteError } = await supabase
                .from('life_events_timeline')
                .delete()
                .contains('source_entry_ids', [docId]);

            if (deleteError) console.error('Error cleaning up old events:', deleteError);

            const eventRows = parsed.life_events.map(
                (e: { title: string; description: string; significance: number; category: string; emotions: string[] }) => ({
                    id: uuidv4(),
                    event_date: new Date().toISOString().split('T')[0], // Default to today since output doesn't give date yet
                    title: e.title,
                    description: e.description,
                    significance: e.significance || 5, // Access constraints or default
                    category: e.category || 'personal',
                    emotions: e.emotions || [],
                    source_entry_ids: [docId] // Link back to document! (Schema allows this)
                })
            );

            const { error: eventsError } = await supabase.from('life_events_timeline').insert(eventRows);
            if (eventsError) {
                console.error('Error inserting life events:', eventsError);
                throw new Error(`Failed to insert life events: ${eventsError.message}`);
            }
        }

        // Insights
        if (parsed.insights && parsed.insights.length > 0) {
            const insightRows = parsed.insights.map((text: string) => ({
                id: uuidv4(),
                insight_text: text,
                type: 'document_upload',
                // source_entry_id omitted to avoid FK error content
            }));

            const { error: insightsError } = await supabase.from('insights').insert(insightRows);
            if (insightsError) console.error('Error inserting insights:', insightsError);
        }

        // 4. Mark Doc Completed
        const { error: completeError } = await supabase.from('uploaded_documents').update({
            processing_status: 'completed',
            insights_generated: {
                people_count: parsed.people?.length || 0,
                events_count: parsed.life_events?.length || 0,
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
            insightsGenerated: parsed.insights?.length || 0,
        });

    } catch (error: any) {
        console.error('Process API error:', error);

        // Try to update status to failed
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
