
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function fixStuckUploads() {
    console.log('Checking for stuck uploads...');

    // Find uploads stuck in 'processing' for more than 5 minutes (or just any pending ones for now since we know it's stuck)
    const { data: stuck } = await supabase
        .from('uploaded_documents')
        .select('id, file_name, created_at')
        .eq('processing_status', 'processing');

    if (!stuck || stuck.length === 0) {
        console.log('No stuck uploads found.');
        return;
    }

    console.log(`Found ${stuck.length} stuck uploads.`);

    for (const doc of stuck) {
        console.log(`Marking ${doc.file_name} as failed...`);
        await supabase
            .from('uploaded_documents')
            .update({ processing_status: 'failed' })
            .eq('id', doc.id);
    }

    console.log('Done.');
}

fixStuckUploads();
