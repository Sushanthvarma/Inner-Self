
import { NextRequest, NextResponse } from 'next/server';
import { processBackgroundFeatures } from '@/lib/extraction';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { entryId, text } = await request.json();

        if (!entryId || !text) {
            return NextResponse.json(
                { error: 'Missing entryId or text' },
                { status: 400 }
            );
        }

        // Trigger background processing
        // In a real serverless env, we might want to await this or use a queue.
        // For this Vercel setup, we'll await it to ensure completion before response closes,
        // or effectively "edge wait". Given the user wants "background", we technically
        // should return 202 and process async, but Vercel functions kill async work 
        // after response. So we MUST await it if we don't have a queue key.
        // However, the client is calling this *separately* from the main UI thread,
        // so it IS background to the user.

        const result = await processBackgroundFeatures(entryId, text);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Background API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
