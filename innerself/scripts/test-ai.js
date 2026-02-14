
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

// Manual mock of getAnthropic since we can't import TS files directly in Node quickly without ts-node
// But wait, the user project is Next.js with TS. I can't just run `node scripts/test-ai.js` on `ai.ts`.
// Usage of `ai.ts` requires compilation.

// Instead, I'll write a script that imports 'anthropic' and calls the API directly with the SAME config as `ai.ts` to verify the model.

const Anthropic = require('@anthropic-ai/sdk');

async function testAI() {
    console.log('Testing Anthropic API connection...');

    if (!envConfig.ANTHROPIC_API_KEY) {
        console.error('Missing ANTHROPIC_API_KEY');
        return;
    }

    const anthropic = new Anthropic({ apiKey: envConfig.ANTHROPIC_API_KEY });
    const modelName = 'claude-3-haiku-20240307';

    console.log(`Using model: ${modelName}`);

    try {
        const startTime = Date.now();
        const response = await anthropic.messages.create({
            model: modelName,
            max_tokens: 100,
            messages: [{ role: 'user', content: 'Say "System Operational" if you can hear me.' }],
        });
        const duration = Date.now() - startTime;

        console.log('Response:', response.content[0].text);
        console.log(`Time taken: ${duration}ms`);
        console.log('✅ AI Engine Test Passed');
    } catch (error) {
        console.error('❌ AI Engine Test Failed:', error.message);
        if (error.status === 404) {
            console.error('Hint: Model name might be invalid.');
        }
    }
}

testAI();
