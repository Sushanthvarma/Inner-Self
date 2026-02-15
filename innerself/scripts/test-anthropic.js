
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

async function testAnthropicSDK() {
    console.log('Testing Anthropic Claude SDK with claude-sonnet-4-20250514...');

    if (!envConfig.ANTHROPIC_API_KEY) {
        console.error('❌ Missing ANTHROPIC_API_KEY');
        return;
    }

    const anthropic = new Anthropic({ apiKey: envConfig.ANTHROPIC_API_KEY });
    const modelName = 'claude-sonnet-4-20250514';

    try {
        const startTime = Date.now();
        const response = await anthropic.messages.create({
            model: modelName,
            max_tokens: 100,
            messages: [{ role: 'user', content: 'Say "System Operational" if you can hear me.' }],
        });
        const duration = Date.now() - startTime;

        const text = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        console.log('Response:', text.trim());
        console.log(`Time taken: ${duration}ms`);
        console.log(`Model: ${modelName}`);
        console.log('✅ Anthropic SDK Test Passed');
    } catch (error) {
        console.error('❌ Anthropic SDK Test Failed:', error.message);
        if (error.status) console.error('Status:', error.status);
    }
}

testAnthropicSDK();
