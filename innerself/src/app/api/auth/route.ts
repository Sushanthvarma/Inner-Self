import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

        // Set auth cookie (httpOnly, secure, 30 days)
        const response = NextResponse.json({ success: true });
        response.cookies.set('inner-self-auth', secret, {
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
