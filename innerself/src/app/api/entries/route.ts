// ============================================================
// INNER SELF — Entries API Route (Log, Tasks, Life Events)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

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
            return NextResponse.json({ entries: data || [] });
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
        const { data, error } = await supabase
            .from('raw_entries')
            .select(`
        id, created_at, raw_text, source,
        extracted_entities(
          id, category, title, content, mood_score,
          surface_emotion, deeper_emotion, energy_level,
          identity_persona, ai_response, ai_persona_used,
          is_task, task_status, people_mentioned
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

// PATCH: Update task status
export async function PATCH(request: NextRequest) {
    try {
        const { id, task_status } = await request.json();
        const supabase = getServiceSupabase();

        const { error } = await supabase
            .from('extracted_entities')
            .update({ task_status })
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update task error:', error);
        return NextResponse.json(
            { error: 'Failed to update task' },
            { status: 500 }
        );
    }
}
