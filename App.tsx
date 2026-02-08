
import React, { useState, useEffect } from 'react';
import { User, Session, QuestionType } from './types';
import Login from './components/Login';
import TeacherDashboard from './components/TeacherDashboard';
import StudentView from './components/StudentView';
import PresentationView from './components/PresentationView';
import AdminDashboard from './components/AdminDashboard';
import { LucideLayout, LucideLogOut, LucideSettings, LucideMonitor } from 'lucide-react';
import { dataService } from './services/dataService';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
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

    // 3. Load sessions
    const loadSessions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSessions([]);
        return;
      }
      const profile = await dataService.getUserProfile(session.user.id);
      const isAdmin = profile?.role === 'ADMIN';
      const data = await dataService.getSessions(isAdmin);
      setSessions(data);
    };

    // Initial load
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
        loadSessions(); // Load sessions after user is confirmed
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
        loadSessions(); // Load sessions on auth change
        setView(role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'DASHBOARD');
      } else {
        // Only clear if it was a teacher or admin (students stay in guest mode)
        setUser(prev => (prev?.role === 'TEACHER' || prev?.role === 'ADMIN') ? null : prev);
        setSessions([]); // Clear sessions on logout
        setView(prev => prev === 'STUDENT' ? 'STUDENT' : 'LOGIN');
      }
    });

    const channel = supabase.channel('public:edu_sessions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'edu_sessions' }, () => {
        loadSessions();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'edu_sessions' }, () => {
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
    if (user?.role === 'TEACHER' || user?.role === 'ADMIN') {
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
    } else {
      alert("Xóa bài giảng thất bại. Có thể do lỗi kết nối hoặc phân quyền.");
    }
  };

  const startPresentation = async (session: Session) => {
    try {
      // 1. Clone session to create a fresh learning instance with new room code
      const freshSession = await dataService.cloneSession(session.id);
      if (!freshSession) {
        alert("Không thể khởi động trình chiếu. Vui lòng kiểm tra lại kết nối.");
        return;
      }

      // 2. Set the NEW session and view
      setCurrentSession(freshSession);
      setView('PRESENTATION');

      // 3. Save to localStorage for recovery
      localStorage.setItem('eduslide_active_presentation', JSON.stringify({
        sessionId: freshSession.id,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Error starting presentation:", error);
      alert("Đã xảy ra lỗi khi khởi động trình chiếu.");
    }
  };

  // Auto-recover active presentation on page reload
  useEffect(() => {
    const recoverPresentation = async () => {
      const saved = localStorage.getItem('eduslide_active_presentation');
      if (!saved || !user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;

      try {
        const { sessionId, timestamp } = JSON.parse(saved);
        // Only recover sessions less than 12 hours old
        if (Date.now() - timestamp > 12 * 60 * 60 * 1000) {
          localStorage.removeItem('eduslide_active_presentation');
          return;
        }

        const session = await dataService.getSessionById(sessionId);
        if (session && session.isActive) {
          setCurrentSession(session);
          setView('PRESENTATION');
          console.log('Auto-recovered presentation:', sessionId);
        } else {
          localStorage.removeItem('eduslide_active_presentation');
        }
      } catch (e) {
        console.error('Error recovering presentation:', e);
        localStorage.removeItem('eduslide_active_presentation');
      }
    };
    recoverPresentation();
  }, [user]);

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
            {user.role === 'ADMIN' && (
              <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                <button
                  onClick={() => setView('DASHBOARD')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'DASHBOARD' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LucideMonitor className="w-3.5 h-3.5" /> Giảng dạy
                </button>
                <button
                  onClick={() => setView('ADMIN_DASHBOARD')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'ADMIN_DASHBOARD' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LucideSettings className="w-3.5 h-3.5" /> Quản trị
                </button>
              </div>
            )}
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
        {view === 'DASHBOARD' && (user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
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
          <PresentationView
            session={currentSession}
            onExit={async () => {
              await dataService.updateSession(currentSession.id, { isActive: false });
              localStorage.removeItem('eduslide_active_presentation');
              setView('DASHBOARD');
            }}
          />
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
