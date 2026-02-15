import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-compatible hash using Web Crypto API
async function hashToken(secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode('inner-self-auth-v1'));
    return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow access to the login page, login API, and static assets
    if (
        pathname === '/login' ||
        pathname === '/api/auth' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.json') ||
        pathname.endsWith('.ico')
    ) {
        return NextResponse.next();
    }

    // Check for the auth cookie
    const authToken = request.cookies.get('inner-self-auth')?.value;
    const secret = process.env.ACCESS_SECRET;

    if (!secret) {
        // If no secret is configured, allow access (dev mode)
        return NextResponse.next();
    }

    // Compare against hashed token (secure) OR raw secret (backward compat with existing sessions)
    const expectedHash = await hashToken(secret);
    if (authToken !== expectedHash && authToken !== secret) {
        // Redirect to login page
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
