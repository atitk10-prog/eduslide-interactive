
import React, { useState, useEffect } from 'react';
import { User, Session, QuestionType } from './types';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentView from './components/StudentView';
import PresentationView from './components/PresentationView';
import AdminDashboard from './components/AdminDashboard';
import { LucideLayout, LucideLogOut } from 'lucide-react';
import { dataService } from './services/dataService';
import { supabase } from './services/supabase';

const INITIAL_SESSIONS: Session[] = [
  {
    id: 'sess-1',
    roomCode: 'BIO9',
    title: 'Giới thiệu về Hệ Sinh Thái - Sinh Học 9',
    currentSlideIndex: 0,
    isActive: true,
    responses: [],
    // Added missing activeQuestionId to satisfy Session interface
    activeQuestionId: null,
    slides: [
      {
        id: 's1',
        title: 'Khái niệm Hệ Sinh Thái',
        content: 'Hệ sinh thái bao gồm quần xã sinh vật và môi trường sống của chúng.',
        imageUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80&w=1000',
        questions: []
      },
      {
        id: 's2',
        title: 'Thành phần cấu trúc',
        content: 'Hãy chọn đáp án đúng nhất về cấu trúc hệ sinh thái.',
        imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1000',
        questions: [
          {
            id: 'q1',
            slideIndex: 1,
            type: QuestionType.MULTIPLE_CHOICE,
            prompt: 'Thành phần vô sinh của hệ sinh thái gồm?',
            options: ['Ánh sáng, nhiệt độ', 'Cây xanh', 'Vi sinh vật', 'Động vật'],
            correctAnswer: 'Ánh sáng, nhiệt độ',
            // Added missing duration property to satisfy Question interface
            duration: 30
          }
        ]
      }
    ]
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD' | 'PRESENTATION' | 'STUDENT' | 'ADMIN_DASHBOARD'>('LOGIN');

  useEffect(() => {
    // 1. Check for student in localStorage (legacy/guest)
    const saved = localStorage.getItem('eduslide_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.role === 'STUDENT') {
        setUser(parsed);
        setView('STUDENT');
      }
    }

    // 2. Check for Supabase Auth session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await dataService.getUserProfile(session.user.id);
        const role = (profile?.role as any) || 'TEACHER';

        const userObj: User = {
          id: session.user.id,
          name: profile?.full_name || session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Người dùng',
          role: role
        };
        setUser(userObj);
        setView(role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'DASHBOARD');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const profile = await dataService.getUserProfile(session.user.id);
        const role = (profile?.role as any) || 'TEACHER';

        const userObj: User = {
          id: session.user.id,
          name: profile?.full_name || session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'Người dùng',
          role: role
        };
        setUser(userObj);
        setView(role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'DASHBOARD');
      } else {
        // Only clear if it was a teacher or admin (students stay in guest mode)
        setUser(prev => (prev?.role === 'TEACHER' || prev?.role === 'ADMIN') ? null : prev);
        setView(prev => prev === 'STUDENT' ? 'STUDENT' : 'LOGIN');
      }
    });

    // 3. Load sessions
    const loadSessions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      let isAdmin = false;
      if (session) {
        const profile = await dataService.getUserProfile(session.user.id);
        isAdmin = profile?.role === 'ADMIN';
      }
      const data = await dataService.getSessions(isAdmin);
      setSessions(data);
    };
    loadSessions();

    const channel = supabase.channel('public:edu_sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edu_sessions' }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
    if (u.role === 'STUDENT') {
      localStorage.setItem('eduslide_user', JSON.stringify(u));
      setView('STUDENT');
    }
  };

  const handleLogout = async () => {
    if (user?.role === 'TEACHER') {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('eduslide_user');
    setView('LOGIN');
  };

  const handleAddSession = async (newSession: Session) => {
    const success = await dataService.createSession(newSession, newSession.slides);
    if (success) {
      setSessions(prev => [newSession, ...prev]);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài giảng này?')) return;
    const success = await dataService.deleteSession(sessionId);
    if (success) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

  const startPresentation = (session: Session) => {
    setCurrentSession(session);
    setView('PRESENTATION');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => user?.role === 'TEACHER' ? setView('DASHBOARD') : null}>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-100">
            <LucideLayout className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            EduSlide
          </h1>
        </div>

        {user && (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">{user.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
            >
              <LucideLogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {view === 'LOGIN' && <Login onLogin={handleLogin} />}
        {view === 'DASHBOARD' && user?.role === 'TEACHER' && (
          <TeacherDashboard
            sessions={sessions}
            onStart={startPresentation}
            onAddSession={handleAddSession}
            onDeleteSession={handleDeleteSession}
          />
        )}
        {view === 'ADMIN_DASHBOARD' && user?.role === 'ADMIN' && (
          <AdminDashboard
            sessions={sessions}
            onDeleteSession={handleDeleteSession}
          />
        )}
        {view === 'PRESENTATION' && currentSession && (
          <PresentationView session={currentSession} onExit={() => setView('DASHBOARD')} />
        )}
        {view === 'STUDENT' && <StudentView user={user!} />}
      </main>

      {view !== 'PRESENTATION' && (
        <footer className="bg-white border-t border-slate-100 py-4 px-6 text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            Hệ thống trình chiếu tương tác &copy; 2024 - Phòng Công Nghệ Giáo Dục
          </p>
        </footer>
      )}
    </div>
  );
};

export default App;
