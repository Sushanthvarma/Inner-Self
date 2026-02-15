
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    const tables = ['life_events_timeline', 'people_map', 'user_persona_summary'];

    for (const table of tables) {
        console.log(`\nChecking for table: ${table}...`);
        const { data, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error(`❌ Error accessing ${table}:`, error.message);
        } else {
            console.log(`✅ ${table} exists! Count:`, data?.length ?? 'Unknown (head)');
            // actually head:true returns count in count var
            const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
            console.log(`   -> Total Rows: ${count}`);
        }
    }
}

checkTable();
