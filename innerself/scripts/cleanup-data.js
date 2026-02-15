const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log('=== DATA CLEANUP ===\n');

    // 1. Deduplicate life events by title (keep newest)
    console.log('--- Life Events ---');
    const { data: events } = await sb.from('life_events_timeline').select('*').order('created_at', { ascending: false });
    if (events && events.length > 0) {
        const seen = new Map();
        const dupeIds = [];
        for (const e of events) {
            const key = e.title.toLowerCase().trim();
            if (seen.has(key)) {
                dupeIds.push(e.id);
            } else {
                seen.set(key, e.id);
            }
        }
        if (dupeIds.length > 0) {
            const { error } = await sb.from('life_events_timeline').delete().in('id', dupeIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + dupeIds.length + ' duplicate events');
        } else {
            console.log('No duplicate events found');
        }
        console.log('Remaining:', events.length - dupeIds.length);
    } else {
        console.log('No events in table');
    }

    // 2. Deduplicate people by name (case-insensitive, merge counts, keep newest)
    console.log('\n--- People Map ---');
    const { data: people } = await sb.from('people_map').select('*').order('last_mentioned', { ascending: false });
    if (people && people.length > 0) {
        const seen = new Map();
        const dupeIds = [];
        for (const p of people) {
            const key = p.name.toLowerCase().trim();
            if (seen.has(key)) {
                // Merge mention count into the kept one
                const keptId = seen.get(key);
                const kept = people.find(x => x.id === keptId);
                if (kept) {
                    await sb.from('people_map').update({
                        mention_count: (kept.mention_count || 0) + (p.mention_count || 0),
                    }).eq('id', keptId);
                }
                dupeIds.push(p.id);
            } else {
                seen.set(key, p.id);
            }
        }
        if (dupeIds.length > 0) {
            const { error } = await sb.from('people_map').delete().in('id', dupeIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + dupeIds.length + ' duplicate people');
        } else {
            console.log('No duplicate people found');
        }
        console.log('Remaining:', people.length - dupeIds.length);
    } else {
        console.log('No people in table');
    }

    // 3. Deduplicate extracted entities by title+entry_id (keep newest)
    console.log('\n--- Extracted Entities ---');
    const { data: entities } = await sb.from('extracted_entities').select('*').order('created_at', { ascending: false });
    if (entities && entities.length > 0) {
        const seen = new Map();
        const dupeIds = [];
        for (const e of entities) {
            const key = (e.title || '').toLowerCase().trim() + '|' + (e.category || '');
            if (seen.has(key)) {
                dupeIds.push(e.id);
            } else {
                seen.set(key, e.id);
            }
        }
        if (dupeIds.length > 0) {
            const { error } = await sb.from('extracted_entities').delete().in('id', dupeIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + dupeIds.length + ' duplicate entities');
        } else {
            console.log('No duplicate entities found');
        }
        console.log('Remaining:', entities.length - dupeIds.length);
    } else {
        console.log('No entities in table');
    }

    // 4. Remove orphaned extracted entities (no matching raw entry)
    console.log('\n--- Orphaned Entities ---');
    const { data: allRaw } = await sb.from('raw_entries').select('id');
    const rawIds = new Set((allRaw || []).map(r => r.id));
    if (entities) {
        const orphanIds = entities.filter(e => !rawIds.has(e.entry_id)).map(e => e.id);
        if (orphanIds.length > 0) {
            const { error } = await sb.from('extracted_entities').delete().in('id', orphanIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + orphanIds.length + ' orphaned entities');
        } else {
            console.log('No orphaned entities');
        }
    }

    // 5. Remove duplicate raw entries (exact same text)
    console.log('\n--- Duplicate Raw Entries ---');
    const { data: rawEntries } = await sb.from('raw_entries').select('*').order('created_at', { ascending: false });
    if (rawEntries && rawEntries.length > 0) {
        const seen = new Map();
        const dupeIds = [];
        for (const r of rawEntries) {
            const key = (r.raw_text || '').trim().substring(0, 200);
            if (seen.has(key)) {
                dupeIds.push(r.id);
            } else {
                seen.set(key, r.id);
            }
        }
        if (dupeIds.length > 0) {
            // Also delete their extracted entities
            await sb.from('extracted_entities').delete().in('entry_id', dupeIds);
            const { error } = await sb.from('raw_entries').delete().in('id', dupeIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + dupeIds.length + ' duplicate raw entries');
        } else {
            console.log('No duplicate raw entries');
        }
        console.log('Remaining:', rawEntries.length - dupeIds.length);
    }

    // 6. Clean duplicate insights
    console.log('\n--- Insights ---');
    const { data: insights } = await sb.from('insights').select('*').order('created_at', { ascending: false });
    if (insights && insights.length > 0) {
        const seen = new Map();
        const dupeIds = [];
        for (const i of insights) {
            const key = (i.insight_text || '').trim().substring(0, 100);
            if (seen.has(key)) {
                dupeIds.push(i.id);
            } else {
                seen.set(key, i.id);
            }
        }
        if (dupeIds.length > 0) {
            const { error } = await sb.from('insights').delete().in('id', dupeIds);
            console.log(error ? 'ERROR: ' + error.message : 'Removed ' + dupeIds.length + ' duplicate insights');
        } else {
            console.log('No duplicate insights');
        }
    } else {
        console.log('No insights in table');
    }

    console.log('\n=== CLEANUP COMPLETE ===');
}

cleanup().catch(console.error);
