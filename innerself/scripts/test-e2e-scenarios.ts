
import { processEntry, processBackgroundFeatures } from '../src/lib/extraction';
import { config } from 'dotenv';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load env
config({ path: path.resolve(process.cwd(), '.env.local') });

// Dummy entry ID generator
const getEntryId = () => uuidv4();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
    console.log('============================================================');
    console.log('🧪 STARTING COMPREHENSIVE E2E SCENARIO TESTING 🧪');
    console.log('============================================================\n');

    // Scenario 1: Basic Emotional Vent
    console.log('🔵 SCENARIO 1: Simple Emotional Vent');
    const text1 = "I'm feeling really overwhelmed today. Work is piling up and I just can't focus.";
    try {
        const res1 = await processEntry(text1, 'text', {});
        if (res1.success) {
            console.log('✅ Extraction Success');
            console.log(`   Title: "${res1.extraction.title}"`);
            console.log(`   Mood: ${res1.extraction.mood_score}/10`);
            console.log(`   Persona Used: ${res1.extraction.ai_persona_used}`);
            console.log(`   Response: "${res1.extraction.ai_response.substring(0, 50)}..."`);
        } else {
            console.error('❌ Extraction Failed:', res1.error);
        }
    } catch (e) { console.error('❌ Exception:', e); }

    console.log('\n------------------------------------------------------------\n');

    // Scenario 2: Task Extraction
    console.log('🔵 SCENARIO 2: Task Extraction');
    const text2 = "I need to call mom tomorrow at 5pm and finish the Q3 report by Friday.";
    try {
        const res2 = await processEntry(text2, 'text', {});
        if (res2.success && res2.extraction.is_task) {
            console.log('✅ Task Detect Success');
            console.log(`   Is Task: ${res2.extraction.is_task}`);
            console.log(`   Task Status: ${res2.extraction.task_status}`);
            console.log(`   Due Date: ${res2.extraction.task_due_date || 'None detected'}`);
        } else {
            console.error('❌ Task Detect Failed (or extraction failed)');
        }
    } catch (e) { console.error('❌ Exception:', e); }

    console.log('\n------------------------------------------------------------\n');

    // Scenario 3: Life Event & Background Processing
    console.log('🔵 SCENARIO 3: Life Event (Background Job)');
    const text3 = "Big news! I finally bought my first car today. It's a Honda City. I'm so proud.";
    const entryId3 = getEntryId();
    try {
        const res3 = await processBackgroundFeatures(entryId3, text3);
        if (res3.success) {
            console.log('✅ Background Process Success');
            console.log('(Check logs above for "1 Life Event" confirmation)');
        } else {
            console.error('❌ Background Process Failed');
        }
    } catch (e) { console.error('❌ Exception:', e); }

    console.log('\n------------------------------------------------------------\n');

    // Scenario 4: Health Metrics (Background Job)
    console.log('🔵 SCENARIO 4: Health Metrics');
    const text4 = "Feeling a bit feverish. Temperature is 101F. Resting today.";
    const entryId4 = getEntryId();
    try {
        const res4 = await processBackgroundFeatures(entryId4, text4);
        if (res4.success) {
            console.log('✅ Health Metric Success');
            console.log('(Check logs above for "Health Metrics" count)');
        } else {
            console.error('❌ Health Metric Failed');
        }
    } catch (e) { console.error('❌ Exception:', e); }

    console.log('\n------------------------------------------------------------\n');

    console.log('🏁 TESTS COMPLETE');
}

runTests();
