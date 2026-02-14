// ============================================================
// INNER SELF — Mirror API Route
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateMirrorQuestion } from '@/lib/ai';
import { getPersonaSummary, getRecentEntries } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
    try {
        const [personaSummary, recentEntries] = await Promise.all([
            getPersonaSummary(),
            getRecentEntries(20),
        ]);

        if (!recentEntries) {
            return NextResponse.json({
                question: "Tell me — what's the one thing you've been avoiding thinking about?",
            });
        }

        const question = await generateMirrorQuestion(
            personaSummary,
            recentEntries
        );

        return NextResponse.json({ question });
    } catch (error) {
        console.error('Mirror API error:', error);
        return NextResponse.json(
            { error: 'Failed to generate mirror question' },
            { status: 500 }
        );
    }
}
