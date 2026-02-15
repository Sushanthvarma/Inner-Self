const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    // Get orphaned IDs
    const { data: allRaw } = await sb.from('raw_entries').select('id, raw_text').order('created_at', { ascending: false }).limit(10);
    const { data: allExt } = await sb.from('extracted_entities').select('entry_id');

    const extIds = new Set((allExt || []).map(e => e.entry_id));

    console.log('TOTAL RAW:', (allRaw || []).length);
    console.log('TOTAL EXTRACTED:', (allExt || []).length);

    for (const r of (allRaw || [])) {
        const hasExtraction = extIds.has(r.id);
        const text = (r.raw_text || '').substring(0, 60).replace(/\n/g, ' ');
        console.log(hasExtraction ? 'OK' : 'MISS', '|', text);
    }

    // People map
    const { data: people } = await sb.from('people_map').select('name, relationship');
    console.log('\nPEOPLE:', (people || []).length);
    for (const p of (people || [])) {
        console.log(' -', p.name, '(' + p.relationship + ')');
    }

    // Entities with people
    const { data: withPeople } = await sb.from('extracted_entities').select('title, people_mentioned').not('people_mentioned', 'eq', '[]');
    console.log('\nENTITIES WITH PEOPLE:', (withPeople || []).length);
    for (const e of (withPeople || [])) {
        console.log(' -', e.title, '|', JSON.stringify(e.people_mentioned));
    }

    // Entities marked as tasks
    const { data: tasks } = await sb.from('extracted_entities').select('title, is_task, task_status');
    console.log('\nTASKS:');
    for (const t of (tasks || [])) {
        console.log(' -', t.title, '| is_task:', t.is_task, '| status:', t.task_status);
    }
}

debug().catch(console.error);
