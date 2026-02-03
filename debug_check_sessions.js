
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Manually parse .env.local
let supabaseUrl = '';
let supabaseKey = '';

try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            if (key.trim() === 'VITE_SUPABASE_URL') supabaseUrl = val.trim();
            if (key.trim() === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val.trim();
        }
    });
} catch (e) {
    console.error("Could not read .env.local", e);
}

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSessions() {
    console.log("Checking sessions...");
    console.log("Supabase URL:", supabaseUrl);

    // 1. Count Total Sessions
    const { count, error: countError } = await supabase
        .from('edu_sessions')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error("Error counting sessions:", countError);
    } else {
        console.log("Total Sessions in DB:", count);
    }

    // 2. Try Fetching one with slides
    const { data, error } = await supabase
        .from('edu_sessions')
        .select(`
        *,
        slides:edu_slides(*)
    `)
        .limit(1);

    if (error) {
        console.error("Error fetching session with slides:", error);
    } else {
        console.log("Sample Session Data:", JSON.stringify(data, null, 2));
    }
}

checkSessions();
