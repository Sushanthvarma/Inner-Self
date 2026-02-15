const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Find orphaned raw entries and reprocess them via the local API
async function reprocessOrphans() {
    // Find all raw entries
    const { data: allRaw, error: e1 } = await sb
        .from('raw_entries')
        .select('id, raw_text, source, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (e1 || !allRaw) {
        console.error('Failed to fetch raw entries:', e1);
        return;
    }

    // Find all extracted entries
    const { data: allExt } = await sb.from('extracted_entities').select('entry_id');
    const extIds = new Set((allExt || []).map(e => e.entry_id));

    // Find orphans
    const orphans = allRaw.filter(r => !extIds.has(r.id));
    console.log('Total raw entries:', allRaw.length);
    console.log('Orphaned entries:', orphans.length);

    if (orphans.length === 0) {
        console.log('No orphans to reprocess!');
        return;
    }

    // Delete orphaned raw entries so processing can re-create them
    for (const orphan of orphans) {
        console.log('\n--- Reprocessing ---');
        console.log('Text:', (orphan.raw_text || '').substring(0, 80));
        console.log('Source:', orphan.source);

        // Delete the orphan raw entry first (pipeline will recreate it)
        const { error: delErr } = await sb.from('raw_entries').delete().eq('id', orphan.id);
        if (delErr) {
            console.error('Delete failed:', delErr.message);
            continue;
        }

        // Re-submit through the API
        try {
            const BASE_URL = process.argv[2] || 'http://localhost:3000';
            const resp = await fetch(`${BASE_URL}/api/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `inner-self-auth=${env.ACCESS_SECRET || '0567'}`,
                },
                body: JSON.stringify({
                    text: orphan.raw_text,
                    source: orphan.source || 'text',
                }),
            });

            const result = await resp.json();
            if (result.success) {
                console.log('SUCCESS:', result.title, '| Task:', result.is_task);
            } else {
                console.error('FAILED:', result.error);
            }
        } catch (err) {
            console.error('API call failed:', err.message);
        }
    }

    console.log('\nDone! Run debug-db.js to verify.');
}

reprocessOrphans().catch(console.error);
