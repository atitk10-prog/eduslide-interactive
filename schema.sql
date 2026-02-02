-- 1. Đảm bảo các bảng cơ bản tồn tại (Không xóa dữ liệu cũ)
CREATE TABLE IF NOT EXISTS public.edu_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'TEACHER', -- 'ADMIN', 'TEACHER'
  provider TEXT DEFAULT 'email', -- 'email', 'google'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.edu_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.edu_profiles(id) ON DELETE CASCADE NOT NULL,
  room_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  current_slide_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  active_question_id TEXT,
  storage_size BIGINT DEFAULT 0, -- Dung lượng bài giảng tính bằng bytes
  score_mode TEXT DEFAULT 'CUMULATIVE', -- 'CUMULATIVE' hoặc 'SINGLE'
  auto_leaderboard BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.edu_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.edu_sessions(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT,
  image_url TEXT,
  pdf_source TEXT,
  pdf_page INTEGER,
  order_index INTEGER DEFAULT 0,
  questions JSONB DEFAULT '[]'::jsonb, -- Lưu nhanh câu hỏi trong slide hoặc dùng bảng riêng
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.edu_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.edu_sessions(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_class TEXT, -- Thêm thông tin lớp học
  question_id TEXT NOT NULL,
  answer JSONB NOT NULL,
  is_manual_correct BOOLEAN DEFAULT NULL, -- NULL: chưa chấm, true: đúng, false: sai
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. CẬP NHẬT CÁC TÍNH NĂNG MỚI (An toàn cho dữ liệu cũ)
ALTER TABLE public.edu_sessions ADD COLUMN IF NOT EXISTS score_mode TEXT DEFAULT 'CUMULATIVE';
ALTER TABLE public.edu_sessions ADD COLUMN IF NOT EXISTS auto_leaderboard BOOLEAN DEFAULT true;
ALTER TABLE public.edu_responses ADD COLUMN IF NOT EXISTS is_manual_correct BOOLEAN DEFAULT NULL;
ALTER TABLE public.edu_profiles ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email';

-- 3. Kích hoạt Real-time (Sử dụng khối DO để tránh lỗi nếu đã tồn tại)
DO $$ 
BEGIN 
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_sessions;
    EXCEPTION WHEN others THEN END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_responses;
    EXCEPTION WHEN others THEN END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_slides;
    EXCEPTION WHEN others THEN END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_profiles;
    EXCEPTION WHEN others THEN END;
END $$;

-- 4. Cập nhật Trigger (Theo dõi provider và gán quyền Admin đặc biệt)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
BEGIN
  -- Mặc định là TEACHER, trừ email đặc biệt
  IF (NEW.email = 'at.it.k10@gmail.com') THEN
    assigned_role := 'ADMIN';
  ELSE
    assigned_role := COALESCE(NEW.raw_user_meta_data->>'role', 'TEACHER');
  END IF;

  INSERT INTO public.edu_profiles (id, full_name, role, provider)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Người dùng mới'),
    assigned_role,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  ) ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = assigned_role,
    provider = EXCLUDED.provider;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_edu ON auth.users;
CREATE TRIGGER on_auth_user_created_edu
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Phân quyền RLS
ALTER TABLE public.edu_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_responses ENABLE ROW LEVEL SECURITY;

-- Dọn dẹp Policy cũ (Tránh lỗi trùng lặp khi chạy lại)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.edu_profiles;
DROP POLICY IF EXISTS "Public sessions are viewable by everyone." ON public.edu_sessions;
DROP POLICY IF EXISTS "Public slides are viewable by everyone." ON public.edu_slides;
DROP POLICY IF EXISTS "Public responses are viewable by everyone." ON public.edu_responses;
DROP POLICY IF EXISTS "Anyone can insert responses." ON public.edu_responses;
DROP POLICY IF EXISTS "Teachers can manage their sessions." ON public.edu_sessions;
DROP POLICY IF EXISTS "Teachers can manage their slides." ON public.edu_slides;
DROP POLICY IF EXISTS "Teachers can update responses for grading." ON public.edu_responses;
DROP POLICY IF EXISTS "Admins can manage profiles." ON public.edu_profiles;

-- Tạo Policy mới
CREATE POLICY "Public profiles are viewable by everyone." ON public.edu_profiles FOR SELECT USING (true);
CREATE POLICY "Public sessions are viewable by everyone." ON public.edu_sessions FOR SELECT USING (true);
CREATE POLICY "Public slides are viewable by everyone." ON public.edu_slides FOR SELECT USING (true);
CREATE POLICY "Public responses are viewable by everyone." ON public.edu_responses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert responses." ON public.edu_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Teachers can manage their sessions." ON public.edu_sessions FOR ALL USING (true);
CREATE POLICY "Teachers can manage their slides." ON public.edu_slides FOR ALL USING (true);
CREATE POLICY "Teachers can update responses for grading." ON public.edu_responses FOR UPDATE USING (true);
CREATE POLICY "Admins can manage profiles." ON public.edu_profiles FOR ALL USING (true);

-- 6. ĐỒNG BỘ DỮ LIỆU CŨ (Nếu bạn đã có user trong Auth trước khi tạo Trigger)
-- Chạy đoạn này để cập nhật toàn bộ user hiện có vào bảng Profiles
INSERT INTO public.edu_profiles (id, full_name, role, provider)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', 'Người dùng cũ'),
  CASE 
    WHEN email = 'at.it.k10@gmail.com' THEN 'ADMIN'
    ELSE COALESCE(raw_user_meta_data->>'role', 'TEACHER')
  END,
  COALESCE(raw_app_meta_data->>'provider', 'email')
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

