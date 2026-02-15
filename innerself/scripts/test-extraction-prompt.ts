
import { extractFromEntry } from '../src/lib/ai';
import { config } from 'dotenv';
import path from 'path';

// Load env from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
    const exampleText = "Yaar aaj bahut frustrating day tha at office. Lloyds mein ye naya project hai na, usmein Rajesh ne pura credit le liya for my work. I built that entire Power BI dashboard and he presented it as his own. Bahut gussa aa raha hai but I can't say anything because he's my skip-level. Came home, didn't eat dinner. Just lying in bed.";

    console.log("Testing extraction with Example 1...");
    console.log("Input:", exampleText);

    try {
        const result = await extractFromEntry(exampleText, "", "");
        console.log("\n--- Extraction Result ---");
        console.log(JSON.stringify(result, null, 2));
        console.log("-------------------------\n");

        // Assertions
        const checks = [
            { name: "Mood is low (approx 3)", passed: result.mood_score <= 4 },
            { name: "Category is 'vent'", passed: result.category === 'vent' },
            { name: "Title captures Rajesh/credit", passed: result.title.toLowerCase().includes('rajesh') || result.title.toLowerCase().includes('credit') },
            { name: "People mentioned includes Rajesh", passed: result.people_mentioned.some(p => p.name.toLowerCase().includes('rajesh')) },
            { name: "AI Persona used", passed: !!result.ai_persona_used },
            { name: "Body signals captured (dinner/bed)", passed: result.body_signals.length > 0 }
        ];

        console.log("--- Verifications ---");
        let allPassed = true;
        checks.forEach(check => {
            if (check.passed) {
                console.log(`✅ ${check.name}`);
            } else {
                console.log(`❌ ${check.name}`);
                allPassed = false;
            }
        });

        if (allPassed) {
            console.log("\n✅ TEST PASSED: Extraction matches expectations.");
        } else {
            console.error("\n❌ TEST FAILED: Some checks failed.");
            process.exit(1);
        }

    } catch (e) {
        console.error("Test execution failed:", e);
        process.exit(1);
    }
}

test();
