
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

async function createTestSession() {
    console.log("Creating test session V2...");

    const { data: profiles } = await supabase.from('edu_profiles').select('id').limit(1);
    if (!profiles || profiles.length === 0) {
        console.error("No profiles found.");
        return;
    }

    const teacherId = profiles[0].id;
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create Session
    const { data: session, error: sessError } = await supabase
        .from('edu_sessions')
        .insert([{
            title: "Bài giảng Test Upload Speed",
            room_code: roomCode,
            teacher_id: teacherId,
            is_active: false,
            current_slide_index: 0
        }])
        .select()
        .single();

    if (sessError) {
        console.error("Error creating session:", sessError);
        return;
    }
    console.log("Session created:", session.id);

    // Add Slide (WITHOUT type column)
    const { data: slide, error: slideError } = await supabase
        .from('edu_slides')
        .insert([{
            session_id: session.id,
            title: "Slide 1",
            content: "Content test",
            order_index: 0
        }])
        .select();

    if (slideError) {
        console.error("Error adding slide:", slideError);
    } else {
        console.log("Slide added successfully:", slide);
    }
}

createTestSession();
