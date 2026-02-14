// ============================================================
// INNER SELF — Chat API Route (RAG-powered conversation)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '@/lib/ai';
import { hybridSearch, getPersonaSummary } from '@/lib/embeddings';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type { AIPersona } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { message, persona, conversationHistory } = await request.json();

        if (!message || message.trim().length === 0) {
            return NextResponse.json(
                { error: 'No message provided' },
                { status: 400 }
            );
        }

        const selectedPersona: AIPersona = persona || 'friend';

        // Get RAG context and persona summary in parallel
        const [ragContext, personaSummary] = await Promise.all([
            hybridSearch(message, 15),
            getPersonaSummary(),
        ]);

        // Generate AI response
        const aiResponse = await generateChatResponse(
            message,
            selectedPersona,
            conversationHistory || [],
            ragContext,
            personaSummary
        );

        // Save conversation to database
        const supabase = getServiceSupabase();
        await supabase.from('conversations').insert([
            {
                id: uuidv4(),
                role: 'user',
                content: message,
                persona_used: selectedPersona,
            },
            {
                id: uuidv4(),
                role: 'assistant',
                content: aiResponse,
                persona_used: selectedPersona,
            },
        ]);

        return NextResponse.json({
            response: aiResponse,
            persona: selectedPersona,
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
