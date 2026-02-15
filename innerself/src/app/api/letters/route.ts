// ============================================================
// INNER SELF — Letters to Future Self API
// Write time-locked letters. Reads only when unlock_at has passed.
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// GET: Fetch letters — unlocked ones readable, locked ones show metadata only
export async function GET() {
    try {
        const supabase = getServiceSupabase();
        const now = new Date().toISOString();

        // Fetch all letters ordered by written date
        const { data: letters, error } = await supabase
            .from('letters_to_future')
            .select('*')
            .order('written_at', { ascending: false });

        if (error) throw error;

        // Separate into unlocked (readable) and locked
        const processed = (letters || []).map(letter => {
            const isUnlocked = new Date(letter.unlock_at) <= new Date(now);
            return {
                id: letter.id,
                written_at: letter.written_at,
                unlock_at: letter.unlock_at,
                is_unlocked: isUnlocked,
                is_read: letter.is_read,
                read_at: letter.read_at,
                mood_when_written: letter.mood_when_written,
                context_summary: letter.context_summary,
                tags: letter.tags,
                // Only include letter text if unlocked
                letter_text: isUnlocked ? letter.letter_text : null,
                // Days until unlock
                days_until_unlock: isUnlocked ? 0 : Math.ceil((new Date(letter.unlock_at).getTime() - new Date(now).getTime()) / (1000 * 60 * 60 * 24)),
            };
        });

        return NextResponse.json({ letters: processed });
    } catch (error) {
        console.error('Letters GET error:', error);
        return NextResponse.json({ error: 'Failed to fetch letters' }, { status: 500 });
    }
}

// POST: Write a new letter to future self
export async function POST(request: NextRequest) {
    try {
        const { letter_text, unlock_at, mood_when_written, tags } = await request.json();

        if (!letter_text || !unlock_at) {
            return NextResponse.json({ error: 'letter_text and unlock_at are required' }, { status: 400 });
        }

        // Validate unlock date is in the future
        if (new Date(unlock_at) <= new Date()) {
            return NextResponse.json({ error: 'unlock_at must be in the future' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Generate a context summary from recent state
        let contextSummary = '';
        try {
            const { data: recent } = await supabase
                .from('extracted_entities')
                .select('title, mood_score, surface_emotion')
                .order('created_at', { ascending: false })
                .limit(5);

            if (recent && recent.length > 0) {
                const avgMood = recent.reduce((a, b) => a + (b.mood_score || 5), 0) / recent.length;
                const emotions = recent.map(e => e.surface_emotion).filter(Boolean).join(', ');
                contextSummary = `When you wrote this, your recent mood was ${avgMood.toFixed(1)}/10. Recent emotions: ${emotions || 'not captured'}.`;
            }
        } catch {
            // Non-fatal
        }

        const id = uuidv4();
        const { error } = await supabase.from('letters_to_future').insert({
            id,
            letter_text,
            written_at: new Date().toISOString(),
            unlock_at: new Date(unlock_at).toISOString(),
            mood_when_written: mood_when_written || null,
            context_summary: contextSummary,
            tags: tags || [],
        });

        if (error) throw error;

        return NextResponse.json({ success: true, id, unlock_at });
    } catch (error) {
        console.error('Letters POST error:', error);
        return NextResponse.json({ error: 'Failed to save letter' }, { status: 500 });
    }
}

// PATCH: Mark a letter as read
export async function PATCH(request: NextRequest) {
    try {
        const { id } = await request.json();
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const supabase = getServiceSupabase();

        // Verify it's unlocked
        const { data: letter } = await supabase
            .from('letters_to_future')
            .select('unlock_at')
            .eq('id', id)
            .single();

        if (!letter || new Date(letter.unlock_at) > new Date()) {
            return NextResponse.json({ error: 'Letter is still locked' }, { status: 403 });
        }

        const { error } = await supabase
            .from('letters_to_future')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Letters PATCH error:', error);
        return NextResponse.json({ error: 'Failed to update letter' }, { status: 500 });
    }
}

// DELETE: Remove a letter
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

        const supabase = getServiceSupabase();
        const { error } = await supabase.from('letters_to_future').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Letters DELETE error:', error);
        return NextResponse.json({ error: 'Failed to delete letter' }, { status: 500 });
    }
}
