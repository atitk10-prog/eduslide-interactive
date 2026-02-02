-- Dọn dẹp Database cũ nếu có
DROP TRIGGER IF EXISTS on_auth_user_created_edu ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TABLE IF EXISTS public.edu_responses;
DROP TABLE IF EXISTS public.edu_questions;
DROP TABLE IF EXISTS public.edu_slides;
DROP TABLE IF EXISTS public.edu_sessions;
DROP TABLE IF EXISTS public.edu_profiles;

-- 1. Bảng Profile người dùng (Giáo viên & Admin)
CREATE TABLE public.edu_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'TEACHER', -- 'ADMIN', 'TEACHER'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Bảng Session (Buổi học/Bài giảng)
CREATE TABLE public.edu_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.edu_profiles(id) ON DELETE CASCADE NOT NULL,
  room_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  current_slide_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false,
  active_question_id TEXT,
  storage_size BIGINT DEFAULT 0, -- Dung lượng bài giảng tính bằng bytes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Bảng Slides
CREATE TABLE public.edu_slides (
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

-- 4. Bảng Kết quả trả lời (Real-time)
CREATE TABLE public.edu_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.edu_sessions(id) ON DELETE CASCADE NOT NULL,
  student_name TEXT NOT NULL,
  student_class TEXT, -- Thêm thông tin lớp học
  question_id TEXT NOT NULL,
  answer JSONB NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Kích hoạt Real-time cho các bảng cần thiết
ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edu_responses;

-- Hàm tự động tạo Profile khi có User mới đăng ký qua Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.edu_profiles (id, full_name, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Người dùng mới'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'TEACHER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_edu
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Phân quyền RLS (Row Level Security) - Tạm thời cho phép mọi người đọc ghi 
-- để dễ phát triển, sau này nên siết chặt lại.
ALTER TABLE public.edu_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON public.edu_profiles FOR SELECT USING (true);
CREATE POLICY "Public sessions are viewable by everyone." ON public.edu_sessions FOR SELECT USING (true);
CREATE POLICY "Public slides are viewable by everyone." ON public.edu_slides FOR SELECT USING (true);
CREATE POLICY "Public responses are viewable by everyone." ON public.edu_responses FOR SELECT USING (true);

-- Cho phép chèn dữ liệu
CREATE POLICY "Anyone can insert responses." ON public.edu_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Teachers can manage their sessions." ON public.edu_sessions FOR ALL USING (true);
CREATE POLICY "Teachers can manage their slides." ON public.edu_slides FOR ALL USING (true);
CREATE POLICY "Admins can manage profiles." ON public.edu_profiles FOR ALL USING (true);
