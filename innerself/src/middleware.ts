import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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

    if (authToken !== secret) {
        // Redirect to login page
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
