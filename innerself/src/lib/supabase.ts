import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to prevent build-time URL validation errors
let _clientInstance: SupabaseClient | null = null;
let _serviceInstance: SupabaseClient | null = null;

// Client-side Supabase client (uses anon key, respects RLS)
export function getSupabase(): SupabaseClient {
    if (!_clientInstance) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
        }

        _clientInstance = createClient(url, key);
    }
    return _clientInstance;
}

// For backward compat — lazy getter
export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
    },
});

// Server-side Supabase client (uses service role key, bypasses RLS)
export function getServiceSupabase(): SupabaseClient {
    if (!_serviceInstance) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) {
            throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        }

        _serviceInstance = createClient(url, key, {
            auth: { persistSession: false },
        });
    }
    return _serviceInstance;
}
