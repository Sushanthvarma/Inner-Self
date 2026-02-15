const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDuplicates() {
    const results = {};

    // Life events
    const { data: events } = await sb.from('life_events_timeline')
        .select('id, title, event_date, category').order('created_at', { ascending: false });
    results.life_events = { total: (events || []).length, items: (events || []).map(e => ({ id: e.id, title: e.title, date: e.event_date, cat: e.category })) };

    // Extracted entities
    const { data: entities } = await sb.from('extracted_entities')
        .select('id, entry_id, title, category, is_task, people_mentioned, created_at').order('created_at', { ascending: false });
    results.entities = { total: (entities || []).length, items: (entities || []).map(e => ({ id: e.id, title: e.title, cat: e.category, task: e.is_task, people: e.people_mentioned })) };

    // People
    const { data: people } = await sb.from('people_map').select('id, name, relationship, mention_count').order('name');
    results.people = { total: (people || []).length, items: people || [] };

    // Raw entries
    const { data: raw } = await sb.from('raw_entries')
        .select('id, raw_text, source, created_at').order('created_at', { ascending: false });
    results.raw = { total: (raw || []).length, items: (raw || []).map(r => ({ id: r.id, text: (r.raw_text || '').substring(0, 60), src: r.source, date: r.created_at })) };

    // Uploaded docs
    const { data: docs } = await sb.from('uploaded_documents')
        .select('id, file_name, status, created_at').order('created_at', { ascending: false });
    results.docs = { total: (docs || []).length, items: docs || [] };

    // Insights
    const { count: insightCount } = await sb.from('insights').select('*', { count: 'exact', head: true });
    results.insights = { total: insightCount };

    // Persona
    const { data: persona } = await sb.from('user_persona_summary').select('*').limit(1);
    results.persona = (persona || []).length > 0 ? 'exists' : 'none';

    console.log(JSON.stringify(results, null, 2));
}

checkDuplicates().catch(console.error);
