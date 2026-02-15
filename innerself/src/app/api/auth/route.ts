import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

function hashToken(secret: string): string {
    return crypto.createHmac('sha256', secret).update('inner-self-auth-v1').digest('hex');
}

export async function POST(request: NextRequest) {
    try {
        const { key } = await request.json();
        const secret = process.env.ACCESS_SECRET;

        if (!secret) {
            return NextResponse.json({ error: 'No access secret configured' }, { status: 500 });
        }

        if (key !== secret) {
            return NextResponse.json({ error: 'Invalid key' }, { status: 401 });
        }

        // Set auth cookie with HASHED token (never store raw secret in cookie)
        const hashedToken = hashToken(secret);
        const response = NextResponse.json({ success: true });
        response.cookies.set('inner-self-auth', hashedToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
        });

        return response;
    } catch {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}

// Export for use in middleware
export { hashToken };
