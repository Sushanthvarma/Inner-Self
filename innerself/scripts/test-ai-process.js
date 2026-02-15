
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

if (!envConfig.ANTHROPIC_API_KEY) {
    console.error('❌ Missing ANTHROPIC_API_KEY');
    process.exit(1);
}

const anthropic = new Anthropic({ apiKey: envConfig.ANTHROPIC_API_KEY });

async function testProcessDocument() {
    const fileName = "SUSHANTH_VARMA_Resume.txt";
    const fileType = "txt";
    const content = `
    SUSHANTH VARMA
    sushanth.varma@example.com | Hyderabad, India

    SUMMARY
    Business Manager at Lloyds Technology Centre with 10+ years in financial services.
    Expert in VBA, Power BI, and Process Simplification.
    
    EXPERIENCE
    Business Manager - Lloyds Technology Centre (Oct 2023 - Present)
    - Managing headcount and financials for 4 labs.
    - Led key strategic initiatives for India location strategy.

    Consultant - Wells Fargo (Apr 2013 - Oct 2023)
    - Simplified regulatory reporting processes.
    - Built automated tools using VBA and Python.

    EDUCATION
    Bachelor of Technology - JNTU Hyderabad (2009-2013)

    PERSONAL
    Located in Hyderabad.
    Grandfather passed away in Feb 2026, which was a major loss.
    `;

    console.log('Testing processDocumentContent with Claude Sonnet...');

    const systemPrompt = `You are Inner Self's document analyzer for Sushanth Varma.

File name: ${fileName}
File type: ${fileType}

Look for:
- People mentioned (names, relationships, sentiments)
- Life events, achievements, milestones
- Goals, plans, aspirations  
- Personal details, values, beliefs
- Behavioral patterns, habits
- Career/professional information
- Health, financial, or relationship details

Respond with ONLY JSON:
{
  "persona_updates": {
    "full_psychological_profile": "new insights from this document",
    "active_goals": [{"goal": "", "status": ""}],
    "core_beliefs_operating": [],
    "recurring_patterns": []
  },
  "people": [{"name": "", "relationship": "", "sentiment_avg": 1-10, "tags": []}],
  "life_events": [{"title": "", "description": "", "significance": 1-10, "category": "", "emotions": []}],
  "insights": ["observations from this document"]
}

Only include fields where you found relevant information. Use empty arrays for fields with no data.`;

    try {
        const startTime = Date.now();
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [
                { role: 'user', content: `DOCUMENT CONTENT:\n${content}` },
                { role: 'assistant', content: '{' },
            ],
        });
        const duration = Date.now() - startTime;

        const text = '{' + response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('');

        console.log('--- AI RAW OUTPUT ---');
        console.log(text);
        console.log('--- END RAW OUTPUT ---');
        console.log(`Time taken: ${duration}ms`);

        const parsed = JSON.parse(text);
        console.log('Parsed JSON Success:', !!parsed);
        if (parsed.life_events && parsed.life_events.length > 0) {
            console.log('✅ Life Events Found:', parsed.life_events.length);
            console.log(JSON.stringify(parsed.life_events, null, 2));
        } else {
            console.log('❌ No Life Events Found');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testProcessDocument();
