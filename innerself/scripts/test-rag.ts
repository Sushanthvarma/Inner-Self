
import { findSimilarEntries } from '../src/lib/embeddings';
import { config } from 'dotenv';
import path from 'path';

// Load env from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
    console.log("Testing RAG Pipeline (Simple Retrieval)...");

    const query = "anxiety about work";
    console.log(`Querying for: "${query}"`);

    try {
        // Note: This test might return empty string if no embeddings exist yet.
        // That is acceptable for a cold start test, as long as it doesn't crash.
        const result = await findSimilarEntries(query);

        console.log("\n--- Result ---");
        if (result) {
            console.log(result);
            console.log("----------------");
            console.log("✅ findSimilarEntries returned data.");
        } else {
            console.log("(No similar entries found - this is expected if DB is empty)");
            console.log("✅ findSimilarEntries handled empty state gracefully.");
        }

    } catch (e) {
        console.error("❌ findSimilarEntries failed:", e);
        process.exit(1);
    }
}

test();
