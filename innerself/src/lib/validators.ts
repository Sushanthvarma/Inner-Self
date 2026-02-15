// ============================================================
// INNER SELF — Centralized Data Validators & Sanitizers
// Single source of truth for all data validation before DB insert.
// Every route that touches life_events, people, insights, etc.
// MUST go through these functions.
// ============================================================

const MIN_SANE_YEAR = 1985;
const VALID_CATEGORIES = ['career', 'relationship', 'family', 'health', 'finance', 'personal', 'education', 'achievement', 'professional_achievement', 'personal_development', 'loss'];
const VALID_COURAGE_TYPES = ['boundary', 'vulnerability', 'risk', 'confrontation', 'honesty', 'change'];
const VALID_DREAM_TYPES = ['normal', 'nightmare', 'recurring', 'lucid'];

// ---- Prompt leakage patterns ----
// These are examples used in AI prompts that should NEVER appear as real data.
// If the AI returns these exact phrases, it hallucinated from the prompt.
const PROMPT_LEAKAGE_PATTERNS = [
    /^(started|joined|got)\s+(a\s+)?(new\s+)?job\s+at\s+(google|acme|example)/i,
    /^my\s+job\s+at\s+google/i,
    /^short\s+title$/i,
    /^what\s+happened$/i,
    /^deep\s+observation\s+\d$/i,
    /^insight\s+text\s+\d$/i,
    /^e\.g\.\s/i,
];

// ---- Date Validators ----

/**
 * For HEALTH METRICS: defaults to today (a measurement is always "now" if unknown).
 */
export function validateDate(raw: string | null | undefined): string {
    if (!raw) return new Date().toISOString().split('T')[0];
    const s = raw.trim().toLowerCase();
    if (['null', 'unknown', 'n/a', 'na', 'none', 'undefined', ''].includes(s)) {
        return new Date().toISOString().split('T')[0];
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
        return raw.trim().substring(0, 10);
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
}

/**
 * For LIFE EVENTS: returns null if date is unknown or suspicious.
 * - Rejects dates before MIN_SANE_YEAR (1985)
 * - Rejects dates more than 1 year in the future
 * - Returns null for unknown/invalid dates (NEVER defaults to today)
 */
export function validateDateNullable(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const s = raw.trim().toLowerCase();
    if (['null', 'unknown', 'n/a', 'na', 'none', 'undefined', ''].includes(s)) {
        return null;
    }

    let dateStr: string | null = null;

    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
        dateStr = raw.trim().substring(0, 10);
    } else if (/^\d{4}$/.test(raw.trim())) {
        dateStr = raw.trim() + '-01-01';
    } else {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
        }
    }

    if (!dateStr) return null;

    // Sanity check: reject obviously wrong dates
    const year = parseInt(dateStr.substring(0, 4), 10);
    const today = new Date();
    const maxYear = today.getFullYear() + 1;
    if (year < MIN_SANE_YEAR || year > maxYear) {
        console.warn(`[validators] Rejected suspicious date "${dateStr}" (year ${year} outside ${MIN_SANE_YEAR}-${maxYear})`);
        return null;
    }

    return dateStr;
}

// ---- Text Sanitizers ----

/**
 * Check if a string looks like prompt leakage (AI echoing example text).
 */
export function isPromptLeakage(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    return PROMPT_LEAKAGE_PATTERNS.some(pattern => pattern.test(text.trim()));
}

/**
 * Sanitize a title string — trim, cap length, reject empty.
 */
export function sanitizeTitle(raw: string | null | undefined): string | null {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    if (trimmed.length > 200) return trimmed.substring(0, 200);
    return trimmed;
}

// ---- Numeric Validators ----

/**
 * Clamp significance to 1-10 range, default 5.
 */
export function validateSignificance(raw: number | null | undefined): number {
    if (raw === null || raw === undefined || isNaN(raw)) return 5;
    return Math.max(1, Math.min(10, Math.round(raw)));
}

/**
 * Clamp mood score to 1-10 range, default 5.
 */
export function validateMoodScore(raw: number | null | undefined): number {
    if (raw === null || raw === undefined || isNaN(raw)) return 5;
    return Math.max(1, Math.min(10, Math.round(raw)));
}

// ---- Category Validators ----

/**
 * Validate event category against whitelist.
 */
export function validateCategory(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return 'personal';
    const normalized = raw.trim().toLowerCase();
    if (VALID_CATEGORIES.includes(normalized)) return normalized;
    // Try fuzzy match
    if (normalized.includes('career') || normalized.includes('work') || normalized.includes('job')) return 'career';
    if (normalized.includes('family')) return 'family';
    if (normalized.includes('relation') || normalized.includes('love') || normalized.includes('marriage') || normalized.includes('partner')) return 'relationship';
    if (normalized.includes('health') || normalized.includes('medical') || normalized.includes('fitness')) return 'health';
    if (normalized.includes('loss') || normalized.includes('death') || normalized.includes('grief') || normalized.includes('passing')) return 'loss';
    if (normalized.includes('money') || normalized.includes('financial')) return 'finance';
    if (normalized.includes('education') || normalized.includes('study') || normalized.includes('degree') || normalized.includes('school')) return 'education';
    if (normalized.includes('achieve') || normalized.includes('award')) return 'achievement';
    return 'personal';
}

export function validateCourageType(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return 'boundary';
    const normalized = raw.trim().toLowerCase();
    if (VALID_COURAGE_TYPES.includes(normalized)) return normalized;
    return 'boundary';
}

export function validateDreamType(raw: string | null | undefined): string {
    if (!raw || typeof raw !== 'string') return 'normal';
    const normalized = raw.trim().toLowerCase();
    if (VALID_DREAM_TYPES.includes(normalized)) return normalized;
    return 'normal';
}

// ---- Array Validators ----

/**
 * Ensure an array of strings — filter out empties, nulls, non-strings.
 */
export function validateStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(s => s.trim());
}

// ---- Composite Validators ----

export interface ValidatedLifeEvent {
    title: string;
    description: string;
    significance: number;
    category: string;
    emotions: string[];
    people_involved: string[];
    event_date: string | null;
}

/**
 * Validate a life event from AI output. Returns null if the event is garbage/leakage.
 */
export function validateLifeEvent(raw: {
    title?: string;
    description?: string;
    significance?: number;
    category?: string;
    emotions?: string[];
    people_involved?: string[];
    event_date?: string;
}): ValidatedLifeEvent | null {
    // Title is required
    const title = sanitizeTitle(raw.title);
    if (!title) {
        console.warn('[validators] Rejected life event: no title');
        return null;
    }

    // Check for prompt leakage
    if (isPromptLeakage(title)) {
        console.warn(`[validators] Rejected life event — prompt leakage detected: "${title}"`);
        return null;
    }

    return {
        title,
        description: (raw.description || '').trim().substring(0, 2000),
        significance: validateSignificance(raw.significance),
        category: validateCategory(raw.category),
        emotions: validateStringArray(raw.emotions),
        people_involved: validateStringArray(raw.people_involved),
        event_date: validateDateNullable(raw.event_date),
    };
}

export interface ValidatedPerson {
    name: string;
    relationship: string;
    sentiment_avg: number;
    tags: string[];
}

/**
 * Validate a person entry. Returns null if garbage.
 */
export function validatePerson(raw: {
    name?: string;
    relationship?: string;
    sentiment_avg?: number;
    sentiment?: string;
    tags?: string[];
}): ValidatedPerson | null {
    if (!raw.name || typeof raw.name !== 'string' || raw.name.trim().length < 2) return null;

    const name = raw.name.trim();

    // Reject obvious AI hallucinations
    if (/^(user|person|someone|example|test|null|undefined|n\/a)$/i.test(name)) {
        console.warn(`[validators] Rejected person — looks like placeholder: "${name}"`);
        return null;
    }

    // Derive numeric sentiment from string if needed
    let sentimentAvg = raw.sentiment_avg;
    if (sentimentAvg === undefined || sentimentAvg === null) {
        if (raw.sentiment === 'positive') sentimentAvg = 7;
        else if (raw.sentiment === 'negative') sentimentAvg = 3;
        else sentimentAvg = 5;
    }
    sentimentAvg = Math.max(1, Math.min(10, Math.round(sentimentAvg)));

    return {
        name,
        relationship: (raw.relationship || 'unknown').trim(),
        sentiment_avg: sentimentAvg,
        tags: validateStringArray(raw.tags),
    };
}
