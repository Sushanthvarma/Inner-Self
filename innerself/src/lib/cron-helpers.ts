// ============================================================
// INNER SELF — Shared Cron Helpers (Auth + Logging)
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from './supabase';

/**
 * Verify CRON_SECRET authorization header.
 * Returns null if auth passes, or a 401 NextResponse if it fails.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If no CRON_SECRET is configured, allow (dev mode)
    if (!cronSecret) {
        console.warn('[Cron] WARNING: No CRON_SECRET configured. Allowing request.');
        return null;
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('[Cron] Unauthorized cron attempt.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return null; // Auth passed
}

/**
 * Start a cron run — inserts a row into cron_runs with status="running".
 * Returns the run ID for later completion.
 */
export async function startCronRun(jobName: string): Promise<string> {
    const supabase = getServiceSupabase();
    const id = crypto.randomUUID();

    const { error } = await supabase.from('cron_runs').insert({
        id,
        job_name: jobName,
        started_at: new Date().toISOString(),
        status: 'running',
    });

    if (error) {
        console.error(`[Cron] Failed to log cron start for ${jobName}:`, error);
    }

    return id;
}

/**
 * Complete a cron run — updates the row with status + summary.
 */
export async function completeCronRun(
    runId: string,
    status: 'completed' | 'failed',
    resultSummary?: Record<string, unknown>,
    error?: string,
    entriesProcessed?: number
): Promise<void> {
    const supabase = getServiceSupabase();

    const { error: updateError } = await supabase
        .from('cron_runs')
        .update({
            completed_at: new Date().toISOString(),
            status,
            result_summary: resultSummary || {},
            error: error || null,
            entries_processed: entriesProcessed || 0,
        })
        .eq('id', runId);

    if (updateError) {
        console.error(`[Cron] Failed to log cron completion for ${runId}:`, updateError);
    }
}
