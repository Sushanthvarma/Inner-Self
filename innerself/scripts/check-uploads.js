
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUploads() {
    console.log('Checking recent uploads...');

    const { data, error } = await supabase
        .from('uploaded_documents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching uploads:', error);
        return;
    }

    if (data.length === 0) {
        console.log('No uploads found in the database.');
    } else {
        console.log('Recent uploads:');
        data.forEach(doc => {
            console.log(`- File: ${doc.file_name}`);
            console.log(`  ID: ${doc.id}`);
            console.log(`  Status: ${doc.processing_status}`);
            console.log(`  Created: ${doc.created_at}`);
            console.log(`  Type: ${doc.file_type}`);
            console.log('-------------------');
        });
    }
}

checkUploads();
