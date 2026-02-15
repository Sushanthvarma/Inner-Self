
import { processBackgroundFeatures } from '../src/lib/extraction';
import { config } from 'dotenv';
import path from 'path';

// Load env from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
    console.log("Testing Background Features Pipeline...");

    // Use a fake entry ID but real text that should trigger detectors
    const fakeEntryId = "00000000-0000-0000-0000-000000000000";
    const text = "I started a new job at Acme Corp today! I'm feeling excited but nervous. Also my weight is 72kg which is good.";

    console.log(`Analyzing: "${text}"`);

    try {
        const result = await processBackgroundFeatures(fakeEntryId, text);

        if (result.success) {
            console.log("✅ processBackgroundFeatures returned success.");
            console.log("(Check DB/logs to confirm 'Acme Corp' job event and '72kg' weight were stored)");
        } else {
            console.error("❌ processBackgroundFeatures returned failure:", result.error);
            process.exit(1);
        }

    } catch (e) {
        console.error("❌ Test failed with exception:", e);
        process.exit(1);
    }
}

test();
