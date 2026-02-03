import { supabase } from './supabase';
import { Session, AnswerResponse, Slide } from '../types';

const isMock = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

export const dataService = {
    // --- Sessions ---
    async getSessions(isAdmin = false): Promise<Session[]> {
        if (isMock) {
            const saved = localStorage.getItem('eduslide_sessions');
            return saved ? JSON.parse(saved) : [];
        }

        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) return [];

        let query = supabase
            .from('edu_sessions')
            .select(`
                *,
                teacher:edu_profiles(full_name),
                slides:edu_slides(*)
            `)
            .order('created_at', { ascending: false });

        if (!isAdmin) {
            query = query.eq('teacher_id', authSession.user.id);
        }

        const { data: sessions, error } = await query;

        if (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }

        return sessions.map((s: any) => ({
            id: s.id,
            roomCode: s.room_code,
            title: s.title,
            teacherName: s.teacher?.full_name || 'N/A',
            currentSlideIndex: s.current_slide_index,
            isActive: s.is_active,
            activeQuestionId: s.active_question_id,
            storageSize: s.storage_size,
            scoreMode: s.score_mode || 'CUMULATIVE',
            basePoints: s.base_points || 100,
            isFocusMode: s.is_focus_mode || false,
            createdAt: s.created_at,
            slides: (s.slides || []).map((sl: any) => ({
                id: sl.id,
                title: sl.title,
                content: sl.content,
                imageUrl: sl.image_url,
                pdfSource: sl.pdf_source,
                pdfPage: sl.pdf_page,
                questions: sl.questions || []
            })).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.title.localeCompare(b.title)),
            responses: []
        }));
    },

    async getSessionById(sessionId: string): Promise<Session | null> {
        if (isMock) {
            const sessions = await this.getSessions();
            return sessions.find(s => s.id === sessionId) || null;
        }

        const { data: sessionData, error: sessionError } = await supabase
            .from('edu_sessions')
            .select(`
                *,
                edu_profiles (full_name)
            `)
            .eq('id', sessionId)
            .maybeSingle();

        if (sessionError || !sessionData) return null;

        const { data: slidesData, error: slidesError } = await supabase
            .from('edu_slides')
            .select('*')
            .eq('session_id', sessionId)
            .order('order_index', { ascending: true });

        if (slidesError) return null;

        return {
            id: sessionData.id,
            roomCode: sessionData.room_code,
            title: sessionData.title,
            currentSlideIndex: sessionData.current_slide_index,
            isActive: sessionData.is_active,
            activeQuestionId: sessionData.active_question_id || undefined,
            storageSize: sessionData.storage_size || 0,
            scoreMode: sessionData.score_mode || 'CUMULATIVE',
            basePoints: sessionData.base_points || 100,
            isFocusMode: sessionData.is_focus_mode || false,
            createdAt: sessionData.created_at,
            slides: (slidesData || []).map((sl: any) => ({
                id: sl.id,
                title: sl.title,
                content: sl.content,
                imageUrl: sl.image_url,
                pdfSource: sl.pdf_source,
                pdfPage: sl.pdf_page,
                questions: sl.questions || []
            })),
            responses: []
        };
    },

    async createSession(session: Omit<Session, 'slides'>, slides: Slide[]): Promise<boolean> {
        const fullSession = { ...session, slides };
        if (isMock) {
            const sessions = await this.getSessions();
            localStorage.setItem('eduslide_sessions', JSON.stringify([fullSession, ...sessions]));
            return true;
        }

        // 1. Get current user
        const { data: { session: authSession } } = await supabase.auth.getSession();
        if (!authSession) {
            console.error('No auth session found');
            return false;
        }

        // 2. Insert session
        const { error: sessionError } = await supabase
            .from('edu_sessions')
            .insert({
                id: session.id,
                room_code: session.roomCode,
                title: session.title,
                teacher_id: authSession.user.id,
                current_slide_index: session.currentSlideIndex,
                is_active: session.isActive,
                storage_size: (session as any).storageSize || 0
            });

        if (sessionError) {
            console.error('Error creating session:', sessionError);
            return false;
        }

        // 3. Insert slides
        const slidesToInsert = slides.map((s, index) => ({
            id: s.id, // Include frontend UUID
            session_id: session.id,
            title: s.title,
            content: s.content,
            image_url: s.imageUrl,
            pdf_source: s.pdfSource,
            pdf_page: s.pdfPage,
            order_index: index
        }));

        const { error: slidesError } = await supabase
            .from('edu_slides')
            .insert(slidesToInsert);

        if (slidesError) {
            console.error('Error creating slides:', slidesError);
            return false;
        }

        return true;
    },

    async updateSession(sessionId: string, data: Partial<Session>): Promise<boolean> {
        if (isMock) {
            const sessions = await this.getSessions();
            const updated = sessions.map(s => s.id === sessionId ? { ...s, ...data } : s);
            localStorage.setItem('eduslide_sessions', JSON.stringify(updated));
            return true;
        }

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.roomCode !== undefined) updateData.room_code = data.roomCode;
        if (data.currentSlideIndex !== undefined) updateData.current_slide_index = data.currentSlideIndex;
        if (data.isActive !== undefined) updateData.is_active = data.isActive;
        if (data.activeQuestionId !== undefined) updateData.active_question_id = data.activeQuestionId;
        if (data.scoreMode !== undefined) updateData.score_mode = data.scoreMode;
        if (data.basePoints !== undefined) updateData.base_points = data.basePoints;
        if (data.isFocusMode !== undefined) updateData.is_focus_mode = data.isFocusMode;

        const { error } = await supabase
            .from('edu_sessions')
            .update(updateData)
            .eq('id', sessionId);

        if (error) {
            console.error('Error updating session:', error);
            return false;
        }

        return true;
    },

    async updateSlide(slideId: string, data: Partial<Slide>): Promise<boolean> {
        if (isMock) {
            // Mock logic omitted for brevity as we focus on real mode, 
            // but normally we'd update localStorage.
            return true;
        }

        const updateData: any = {};
        if (data.title !== undefined) updateData.title = data.title;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
        if (data.pdfSource !== undefined) updateData.pdf_source = data.pdfSource;
        if (data.pdfPage !== undefined) updateData.pdf_page = data.pdfPage;
        if (data.questions !== undefined) updateData.questions = data.questions;
        if (data.order_index !== undefined) updateData.order_index = data.order_index;

        const { error } = await supabase
            .from('edu_slides')
            .update(updateData)
            .eq('id', slideId);

        return !error;
    },

    async deleteSlide(slideId: string): Promise<boolean> {
        if (isMock) return true;
        const { error } = await supabase
            .from('edu_slides')
            .delete()
            .eq('id', slideId);
        return !error;
    },

    async deleteSession(sessionId: string): Promise<boolean> {
        if (isMock) {
            const sessions = await this.getSessions();
            const filtered = sessions.filter(s => s.id !== sessionId);
            localStorage.setItem('eduslide_sessions', JSON.stringify(filtered));
            return true;
        }

        const { error } = await supabase
            .from('edu_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            console.error('Error deleting session:', error);
            return false;
        }

        return true;
    },

    async cloneSession(sessionId: string): Promise<Session | null> {
        if (isMock) return null;

        // 1. Get original session and slides
        const original = await this.getSessionById(sessionId);
        if (!original) return null;

        // 2. Generate new room code
        let newRoomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
        let isUnique = await this.isRoomCodeUnique(newRoomCode);
        while (!isUnique) {
            newRoomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
            isUnique = await this.isRoomCodeUnique(newRoomCode);
        }

        // 3. Create new session object (cloned)
        const newSessionId = crypto.randomUUID();
        const newSession: Session = {
            ...original,
            id: newSessionId,
            roomCode: newRoomCode,
            title: `${original.title} - ${new Date().toLocaleDateString('vi-VN')}`,
            currentSlideIndex: 0,
            isActive: true,
            responses: [],
            activeQuestionId: null,
            createdAt: new Date().toISOString()
        };

        // 4. Create session in DB
        const success = await this.createSession(newSession, original.slides.map(s => ({
            ...s,
            id: crypto.randomUUID() // New IDs for slides
        })));

        if (!success) return null;

        return { ...newSession, slides: original.slides };
    },

    async submitResponse(response: AnswerResponse): Promise<boolean> {
        if (isMock) {
            const key = `responses_${response.sessionId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify([...existing, response]));
            return true;
        }

        try {
            const { error } = await supabase
                .from('edu_responses')
                .insert({
                    session_id: response.sessionId,
                    student_name: response.studentName,
                    student_class: (response as any).studentClass || 'N/A',
                    question_id: response.questionId,
                    answer: response.answer,
                    timestamp: response.timestamp
                });

            if (error) throw error;
            return true;
        } catch (err) {
            console.warn('Network error, buffering response offline:', err);
            // Save to offline queue
            const queue = JSON.parse(localStorage.getItem('edu_offline_responses') || '[]');
            localStorage.setItem('edu_offline_responses', JSON.stringify([...queue, response]));
            return true; // Return true as it's buffered
        }
    },

    async syncOfflineData(): Promise<void> {
        if (isMock) return;
        const queue = JSON.parse(localStorage.getItem('edu_offline_responses') || '[]');
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} offline responses...`);
        const remaining: AnswerResponse[] = [];

        for (const resp of queue) {
            try {
                const { error } = await supabase
                    .from('edu_responses')
                    .insert({
                        session_id: resp.sessionId,
                        student_name: resp.studentName,
                        student_class: (resp as any).studentClass || 'N/A',
                        question_id: resp.questionId,
                        answer: resp.answer,
                        timestamp: resp.timestamp
                    });
                if (error) throw error;
            } catch (err) {
                remaining.push(resp);
            }
        }

        if (remaining.length === 0) {
            localStorage.removeItem('edu_offline_responses');
        } else {
            localStorage.setItem('edu_offline_responses', JSON.stringify(remaining));
        }
    },

    async getResponses(sessionId: string): Promise<AnswerResponse[]> {
        if (isMock) {
            const key = `responses_${sessionId}`;
            return JSON.parse(localStorage.getItem(key) || '[]');
        }

        const { data, error } = await supabase
            .from('edu_responses')
            .select('*')
            .eq('session_id', sessionId);

        if (error) return [];
        return data.map((r: any) => ({
            sessionId: r.session_id,
            studentName: r.student_name,
            questionId: r.question_id,
            answer: r.answer,
            timestamp: Number(r.timestamp)
        }));
    },

    async isRoomCodeUnique(code: string): Promise<boolean> {
        if (isMock) {
            const sessions = await this.getSessions();
            return !sessions.find(s => s.roomCode === code);
        }
        const { data } = await supabase
            .from('edu_sessions')
            .select('room_code')
            .eq('room_code', code)
            .maybeSingle();

        return !data;
    },

    async getSessionByRoomCode(code: string): Promise<Session | null> {
        if (isMock) {
            const sessions = await this.getSessions();
            return sessions.find(s => s.roomCode === code && s.isActive) || null;
        }

        const { data, error } = await supabase
            .from('edu_sessions')
            .select('*, slides:edu_slides(*)')
            .eq('room_code', code)
            .eq('is_active', true)
            .single();

        if (error || !data) return null;

        return {
            ...data,
            roomCode: data.room_code,
            currentSlideIndex: data.current_slide_index,
            isActive: data.is_active,
            activeQuestionId: data.active_question_id,
            storageSize: data.storage_size,
            createdAt: data.created_at,
            slides: (data.slides || []).map((s: any) => ({
                id: s.id,
                title: s.title,
                content: s.content,
                imageUrl: s.image_url,
                pdfSource: s.pdf_source,
                pdfPage: s.pdf_page,
                questions: s.questions || [],
                order_index: s.order_index
            })).sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.title.localeCompare(b.title)),
            scoreMode: data.score_mode || 'CUMULATIVE',
            basePoints: data.base_points || 100,
            isFocusMode: data.is_focus_mode || false,
            autoLeaderboard: data.auto_leaderboard !== false
        } as Session;
    },

    // --- Q&A Box ---
    async getQAQuestions(sessionId: string): Promise<any[]> {
        if (isMock) return [];
        const { data, error } = await supabase
            .from('edu_qa_questions')
            .select('*')
            .eq('session_id', sessionId)
            .order('timestamp', { ascending: true });
        return data || [];
    },

    async submitQAQuestion(sessionId: string, studentName: string, content: string): Promise<any> {
        if (isMock) return null;
        const { data, error } = await supabase
            .from('edu_qa_questions')
            .insert({
                session_id: sessionId,
                student_name: studentName,
                content: content,
                timestamp: Date.now()
            })
            .select()
            .single();
        return data;
    },

    async upvoteQAQuestion(qaId: string, studentName: string): Promise<boolean> {
        if (isMock) return true;

        // Fetch current upvotes
        const { data } = await supabase.from('edu_qa_questions').select('upvotes').eq('id', qaId).single();
        const currentUpvotes = data?.upvotes || [];

        if (currentUpvotes.includes(studentName)) return true;

        const { error } = await supabase
            .from('edu_qa_questions')
            .update({ upvotes: [...currentUpvotes, studentName] })
            .eq('id', qaId);
        return !error;
    },

    // --- Quick Polls ---
    async getPolls(sessionId: string): Promise<any[]> {
        if (isMock) return [];
        const { data, error } = await supabase
            .from('edu_polls')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false });
        return data || [];
    },

    async createPoll(sessionId: string, prompt: string, options: string[]): Promise<any> {
        if (isMock) return null;
        const { data, error } = await supabase
            .from('edu_polls')
            .insert({
                session_id: sessionId,
                prompt,
                options,
                is_active: true
            })
            .select()
            .single();
        return data;
    },

    async submitPollResponse(pollId: string, studentName: string, option: string): Promise<boolean> {
        if (isMock) return true;

        // Fetch current responses
        const { data } = await supabase.from('edu_polls').select('responses').eq('id', pollId).single();
        const currentResponses = data?.responses || {};

        const { error } = await supabase
            .from('edu_polls')
            .update({ responses: { ...currentResponses, [studentName]: option } })
            .eq('id', pollId);
        return !error;
    },

    async updatePollActive(pollId: string, isActive: boolean): Promise<boolean> {
        if (isMock) return true;
        const { error } = await supabase
            .from('edu_polls')
            .update({ is_active: isActive })
            .eq('id', pollId);
        return !error;
    },

    // --- Auth & Profiles ---
    async createTeacherAccount(email: string, password: string, name: string): Promise<{ success: boolean; message: string }> {
        if (isMock) return { success: false, message: 'Mock mode: Signup disabled' };

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name, role: 'TEACHER' }
            }
        });

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Đã tạo tài khoản giáo viên thành công' };
    },

    async updateMyPassword(newPassword: string): Promise<{ success: boolean; message: string }> {
        if (isMock) return { success: false, message: 'Mock mode: Password update disabled' };
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Cập nhật mật khẩu thành công' };
    },

    async getAllTeacherProfiles(): Promise<{ data: any[] | null; error: any }> {
        if (isMock) return { data: [], error: null };
        const { data, error } = await supabase
            .from('edu_profiles')
            .select('*')
            .eq('role', 'TEACHER');
        return { data, error };
    },

    async resetTeacherPassword(email: string): Promise<{ success: boolean; message: string }> {
        if (isMock) return { success: false, message: 'Mock mode: Password reset disabled' };
        // In a real scenario with Supabase Admin SDK, we could set the password directly.
        // For client-side, we can only send a reset email or use a custom edge function.
        // Assuming we use a simplified approach since we don't have Admin SDK access here.
        // I will implement a notification of the intent for now or use the standard reset flow.
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Đã gửi yêu cầu đặt lại mật khẩu tới email của giáo viên' };
    },

    async getTeacherStorageStats(teacherId: string): Promise<number> {
        if (isMock) return 0;
        const { data, error } = await supabase
            .from('edu_sessions')
            .select('storage_size')
            .eq('teacher_id', teacherId);

        if (error) return 0;
        return data.reduce((acc, curr) => acc + (curr.storage_size || 0), 0);
    },

    async getUserProfile(userId: string): Promise<{ full_name: string; role: string } | null> {
        if (isMock) return null;
        const { data, error } = await supabase
            .from('edu_profiles')
            .select('full_name, role')
            .eq('id', userId)
            .maybeSingle();

        if (error) return null;
        return data;
    },

    // --- Storage ---
    async uploadPDF(file: File): Promise<string | null> {
        console.log("Starting PDF upload for:", file.name, "Size:", file.size);
        if (isMock) {
            try {
                const url = URL.createObjectURL(file);
                console.log("Mock upload successful, created Blob URL:", url);
                return url;
            } catch (err) {
                console.error("Error creating Blob URL:", err);
                return null;
            }
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `slides/${fileName}`;

        console.log("Real upload to Supabase:", filePath);
        const { error: uploadError } = await supabase.storage
            .from('eduslide-assets')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading PDF to Supabase:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('eduslide-assets')
            .getPublicUrl(filePath);

        console.log("Supabase upload successful, Public URL:", data.publicUrl);
        return data.publicUrl;
    }
};

