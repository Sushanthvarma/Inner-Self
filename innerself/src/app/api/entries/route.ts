// ============================================================
// INNER SELF — Entries API Route (Log, Tasks, Life Events)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { processEntry } from '@/lib/extraction';

export const dynamic = 'force-dynamic';

// GET: Fetch entries with optional filters
export async function GET(request: NextRequest) {
    try {
        const supabase = getServiceSupabase();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all'; // all, tasks, life
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        if (type === 'tasks') {
            // Fetch tasks only
            const { data, error } = await supabase
                .from('extracted_entities')
                .select(`
          id, entry_id, title, content, task_status, task_due_date,
          mood_score, category, created_at,
          raw_entries!inner(created_at)
        `)
                .eq('is_task', true)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            // Compute staleness
            const now = new Date();
            const enhancedTasks = (data || []).map((task: any) => {
                const created = new Date(task.created_at);
                const ageDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    ...task,
                    age_days: ageDays,
                    is_stale: task.task_status === 'pending' && ageDays > 14
                };
            });

            return NextResponse.json({ entries: enhancedTasks });
        }

        if (type === 'life') {
            // Fetch life events
            const { data, error } = await supabase
                .from('life_events_timeline')
                .select('*')
                .order('event_date', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return NextResponse.json({ events: data || [] });
        }

        if (type === 'people') {
            // Fetch people map
            const { data, error } = await supabase
                .from('people_map')
                .select('*')
                .order('last_mentioned', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ people: data || [] });
        }

        // Fetch all entries with extracted entities
        // Includes extended psychological fields for the new LogView
        const { data, error } = await supabase
            .from('raw_entries')
            .select(`
        id, created_at, raw_text, source, audio_url, audio_duration_sec,
        extracted_entities(
          id, category, title, content, mood_score,
          surface_emotion, deeper_emotion, energy_level,
          identity_persona, ai_response, ai_persona_used,
          is_task, task_status, people_mentioned, beliefs_revealed,
          core_need, triggers, defense_mechanism, self_talk_tone,
          cognitive_pattern, avoidance_signal, growth_edge, body_signals,
          follow_up_question
        ),
        health_metrics(
          id, metric_name, value, unit, status
        )
      `)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return NextResponse.json({ entries: data || [] });
    } catch (error) {
        console.error('Entries API error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch entries' },
            { status: 500 }
        );
    }
}

// PATCH: Update task status or entry content
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, task_status, raw_text, title, content } = body;
        const supabase = getServiceSupabase();

        if (task_status !== undefined) {
            // Update task status
            const { error } = await supabase
                .from('extracted_entities')
                .update({ task_status })
                .eq('id', id);
            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        if (raw_text !== undefined) {
            const shouldReprocess = body.reprocess_ai === true;

            if (shouldReprocess) {
                // Full Re-Process: AI extraction, People Map, Beliefs, etc.
                console.log(`[Entries API] Reprocessing entry ${id}...`);
                await processEntry(raw_text, 'text', { existingEntryId: id });
                return NextResponse.json({ success: true, reprocessed: true });
            } else {
                // Simple Text Update (No AI)
                const { error: rawErr } = await supabase
                    .from('raw_entries')
                    .update({ raw_text })
                    .eq('id', id);
                if (rawErr) throw rawErr;

                // Also update extracted entity title/content if provided
                if (title !== undefined || content !== undefined) {
                    const updates: Record<string, unknown> = {};
                    if (title !== undefined) updates.title = title;
                    if (content !== undefined) updates.content = content;

                    const { error: entErr } = await supabase
                        .from('extracted_entities')
                        .update(updates)
                        .eq('entry_id', id);
                    if (entErr) console.error('Entity update error:', entErr);
                }
                return NextResponse.json({ success: true });
            }
        }

        return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    } catch (error) {
        console.error('Update entry error:', error);
        return NextResponse.json(
            { error: 'Failed to update entry' },
            { status: 500 }
        );
    }
}

// DELETE: Soft-delete a raw entry
export async function DELETE(request: NextRequest) {
    try {
        const { id } = await request.json();
        const supabase = getServiceSupabase();

        if (!id) {
            return NextResponse.json({ error: 'No id provided' }, { status: 400 });
        }

        // Soft-delete: set deleted_at
        const { error } = await supabase
            .from('raw_entries')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        console.log('[Entries] Soft-deleted entry:', id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete entry error:', error);
        return NextResponse.json(
            { error: 'Failed to delete entry' },
            { status: 500 }
        );
    }
}
