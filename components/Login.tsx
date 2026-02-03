
import React, { useState } from 'react';
import { User } from '../types';
import { LucideUserCircle, LucideGraduationCap, LucideShieldCheck, LucideMail, LucideLock, LucideArrowRight, LucideLoader2 } from 'lucide-react';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'TEACHER' | 'STUDENT' | 'ADMIN' | null>(null);

  const handleStudentLogin = () => {
    if (!name.trim()) {
      alert('Vui lòng nhập tên của bạn');
      return;
    }
    onLogin({
      id: `std-${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      role: 'STUDENT'
    });
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);

    const fullEmail = email.includes('@') ? email : `${email}@edu.vn`;

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: fullEmail,
          password,
          options: {
            data: { full_name: name || 'Giáo viên', role: 'TEACHER' }
          }
        });
        if (error) throw error;
        alert('Đăng ký thành công! Hãy đăng nhập.');
        setIsSignUp(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: fullEmail,
          password
        });
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (selectedRole === 'TEACHER' || selectedRole === 'ADMIN') {
    const isAdmin = selectedRole === 'ADMIN';
    return (
      <div className="flex items-center justify-center p-6 h-full min-h-[80vh]">
        <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 border border-slate-100 flex flex-col gap-8 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-2 bg-gradient-to-r ${isAdmin ? 'from-slate-800 to-slate-900' : 'from-blue-600 to-indigo-600'}`} />
          <button onClick={() => setSelectedRole(null)} className="text-slate-400 font-bold text-xs uppercase hover:text-slate-900 self-start">← Quay lại</button>

          <div className="text-center">
            <h2 className="text-3xl font-black text-slate-900 mb-2">{isAdmin ? 'Quản Trị Hệ Thống' : (isSignUp ? 'Tạo tài khoản' : 'Đăng nhập')}</h2>
            <p className="text-slate-500 font-medium">{isAdmin ? 'Sử dụng tài khoản quản trị để truy cập' : 'Dành cho Giáo viên điều phối buổi học'}</p>
          </div>

          <form onSubmit={handleTeacherAuth} className="space-y-4">
            {isSignUp && !isAdmin && (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Họ và tên</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" placeholder="Nguyễn Văn A" required />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Tài khoản</label>
              <div className="relative">
                <LucideMail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" placeholder={isAdmin ? 'admin' : 'tên_đăng_nhập'} required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Mật khẩu</label>
              <div className="relative">
                <LucideLock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" placeholder="••••••••" required />
              </div>
            </div>

            <button disabled={loading} type="submit" className={`w-full ${isAdmin ? 'bg-slate-900 shadow-slate-100' : 'bg-indigo-600 shadow-indigo-100'} text-white py-5 rounded-2xl font-black shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95`}>
              {loading ? <LucideLoader2 className="animate-spin" /> : (isAdmin ? 'XÁC THỰC ADMIN' : (isSignUp ? 'ĐĂNG KÝ NGAY' : 'VÀO HỆ THỐNG'))}
              <LucideArrowRight className="w-5 h-5" />
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">{isAdmin ? 'Hoặc đăng nhập với' : 'Hoặc tiếp tục với'}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full bg-white border-2 border-slate-100 text-slate-900 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Dùng tài khoản Google
            </button>
          </form>

          {!isAdmin && (
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
              {isSignUp ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký ngay'}
            </button>
          )}

          {isAdmin && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Gợi ý: Dùng tài khoản admin chính để quản lý toàn bộ hệ thống</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-6 h-full min-h-[80vh]">
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200 w-full max-w-4xl p-10 border border-slate-100">
        <div className="text-center mb-10">
          <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">EduSlide</h2>
          <p className="text-slate-500 font-medium italic">Giải pháp trình chiếu tương tác hiện đại cho lớp học.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button onClick={() => setSelectedRole('TEACHER')} className="group bg-indigo-600 p-8 rounded-[2rem] text-white flex flex-col items-center gap-4 transition-all hover:scale-105 hover:shadow-2xl shadow-indigo-200">
            <div className="bg-white/20 p-5 rounded-[1.5rem] group-hover:bg-white/30 transition-colors">
              <LucideGraduationCap className="w-10 h-10" />
            </div>
            <div className="text-center">
              <span className="block text-lg font-black uppercase tracking-widest">GIÁO VIÊN</span>
              <span className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Tạo & Giảng dạy</span>
            </div>
          </button>

          <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 space-y-4 flex flex-col shadow-inner">
            <div className="flex items-center gap-3">
              <LucideUserCircle className="w-6 h-6 text-indigo-600" />
              <span className="font-black text-slate-800 uppercase text-xs tracking-widest">HỌC SINH</span>
            </div>
            <input
              type="text"
              placeholder="Họ tên của bạn..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold text-sm"
            />
            <button onClick={handleStudentLogin} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] tracking-widest hover:bg-indigo-600 transition-all active:scale-95 mt-auto">VÀO LỚP</button>
          </div>

          <button onClick={() => setSelectedRole('ADMIN')} className="group bg-slate-800 p-8 rounded-[2rem] text-white flex flex-col items-center gap-4 transition-all hover:bg-slate-950 hover:scale-105 shadow-xl">
            <div className="bg-white/10 p-5 rounded-[1.5rem] group-hover:bg-white/20 transition-colors">
              <LucideShieldCheck className="w-10 h-10 text-white" />
            </div>
            <div className="text-center">
              <span className="block text-lg font-black uppercase tracking-widest">QUẢN TRỊ</span>
              <span className="text-[10px] opacity-70 font-bold uppercase tracking-widest">Hệ thống</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
 
