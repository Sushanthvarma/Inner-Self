
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

async function testGeminiSDK() {
    console.log('Testing Google Gemini SDK with gemini-2.0-flash...');

    if (!envConfig.GEMINI_API_KEY) {
        console.error('❌ Missing GEMINI_API_KEY');
        return;
    }

    const genAI = new GoogleGenerativeAI(envConfig.GEMINI_API_KEY);
    const modelName = 'gemini-2.0-flash-lite-001';

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "System Operational" if you can hear me.');
        const response = await result.response;
        const text = response.text();

        console.log('Response:', text.trim());
        console.log(`✅ SDK Test Passed with ${modelName}`);
    } catch (error) {
        console.error('❌ SDK Test Failed:', error.message);
        if (error.response) console.error('Details:', JSON.stringify(error.response, null, 2));
    }
}

testGeminiSDK();
