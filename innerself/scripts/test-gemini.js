
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('Testing Google Gemini API connection...');

    if (!envConfig.GEMINI_API_KEY) {
        console.error('❌ Missing GEMINI_API_KEY in .env.local');
        console.log('Please get a free key from https://aistudio.google.com/app/apikey');
        return;
    }

    const genAI = new GoogleGenerativeAI(envConfig.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    console.log(`Using model: gemini-1.5-flash`);

    try {
        const startTime = Date.now();
        const result = await model.generateContent('Say "System Operational" if you can hear me.');
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - startTime;

        console.log('Response:', text.trim());
        console.log(`Time taken: ${duration}ms`);
        console.log('✅ AI Engine Test Passed');
    } catch (error) {
        console.error('❌ AI Engine Test Failed:', error.message);
    }
}

testGemini();
