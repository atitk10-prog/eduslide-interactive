
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
    console.log("Creating test session...");

    // 1. Get a distinct teacher ID (or create a dummy one if needed, but better to use existing)
    const { data: profiles, error: profileError } = await supabase
        .from('edu_profiles')
        .select('id')
        .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
        console.error("No profiles found to assign session to:", profileError);
        return;
    }

    const teacherId = profiles[0].id; // Use the first found user
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newSession = {
        title: "Bài giảng Kiem tra He thong",
        room_code: roomCode,
        teacher_id: teacherId,
        is_active: false,
        current_slide_index: 0
    };

    const { data, error } = await supabase
        .from('edu_sessions')
        .insert([newSession])
        .select()
        .single();

    if (error) {
        console.error("Error creating session:", error);
    } else {
        console.log("Successfully created session:", data);
        console.log("Adding a slide...");

        // Add a slide
        const { error: slideError } = await supabase
            .from('edu_slides')
            .insert([{
                session_id: data.id,
                title: "Slide 1",
                content: "Welcome to EduSlide Test",
                order_index: 0,
                type: "IMAGE"
            }]);

        if (slideError) console.error("Error adding slide:", slideError);
        else console.log("Successfully added test slide.");
    }
}

createTestSession();
