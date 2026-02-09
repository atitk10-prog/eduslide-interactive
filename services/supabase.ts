import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials missing. Check your .env.local file.");
}

// Retry-capable fetch for network resilience
const retryFetch = (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000;

    const attempt = async (retries: number): Promise<Response> => {
        try {
            const res = await fetch(url, options);
            return res;
        } catch (err) {
            if (retries > 0) {
                await new Promise(r => setTimeout(r, RETRY_DELAY));
                return attempt(retries - 1);
            }
            throw err;
        }
    };
    return attempt(MAX_RETRIES);
};

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        global: { fetch: retryFetch },
        auth: { persistSession: true, autoRefreshToken: true }
    }
);

// Utility: retry an async operation
export const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> => {
    try {
        return await fn();
    } catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            return withRetry(fn, retries - 1, delay);
        }
        throw err;
    }
};
