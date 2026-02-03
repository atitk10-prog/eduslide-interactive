
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
} catch (e) { }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDB() {
    console.log("Checking DB...");

    // Count Profiles
    const { count: profileCount } = await supabase.from('edu_profiles').select('*', { count: 'exact', head: true });
    console.log("Profiles:", profileCount);

    // Count Sessions
    const { count: sessionCount } = await supabase.from('edu_sessions').select('*', { count: 'exact', head: true });
    console.log("Sessions:", sessionCount);
}

checkDB();
