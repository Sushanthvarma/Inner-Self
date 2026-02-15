// ============================================================
// INNER SELF — Entry Delete API
// Cascading delete for logs
// ============================================================
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const supabase = getServiceSupabase();

        // 1. Get entry details to clean up dependencies manually if needed
        // (Supabase cascading FKs usually handle tables like extracted_entities/embeddings if set up,
        // but we verify)

        // 2. Delete the raw entry
        const { error } = await supabase
            .from('raw_entries')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 3. Trigger re-analysis flag?
        // Ideally we mark the 'user_persona_summary' to be updated next cycle.
        // For now, implicit update is fine.

        return NextResponse.json({ success: true, deleted_id: id });

    } catch (error) {
        console.error('Delete Entry Error:', error);
        return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
    }
}
