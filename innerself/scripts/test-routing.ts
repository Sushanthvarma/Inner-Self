
import { updatePeopleMap, updateBeliefSystem } from '../src/lib/extraction';
import { config } from 'dotenv';
import path from 'path';

// Load env from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
    console.log("Testing Field-to-Tab Routing...");

    // Test Belief System
    console.log("\n--- Testing Belief System ---");
    const testBeliefs = ["I am capable of change", "Hard work is rewarding"];
    const fakeEntryId = "00000000-0000-0000-0000-000000000000"; // Fake ID

    try {
        await updateBeliefSystem(testBeliefs, fakeEntryId);
        console.log("✅ updateBeliefSystem executed without error.");
    } catch (e) {
        console.error("❌ updateBeliefSystem failed:", e);
        process.exit(1);
    }

    // Test People Map
    console.log("\n--- Testing People Map ---");
    const testPeople = [
        { name: "RoutingTestUser", relationship: "TestSubject", sentiment: "positive", context: "Testing the routing logic" }
    ];

    try {
        await updatePeopleMap(testPeople);
        console.log("✅ updatePeopleMap executed without error.");
    } catch (e) {
        console.error("❌ updatePeopleMap failed:", e);
        process.exit(1);
    }

    console.log("\n✅ ROUTING TESTS PASSED (Check DB for rows 'RoutingTestUser' and 'I am capable of change')");
}

test();
