
import React, { useState } from 'react';
import { Session } from '../types';
import { dataService } from '../services/dataService';
import { LucideTrash2, LucideShieldCheck, LucideSearch, LucideUser, LucideFileText, LucideClock, LucideLoader2, LucideLock, LucideMonitor, LucideDatabase } from 'lucide-react';
import { toast } from './Toast';

interface AdminDashboardProps {
    sessions: Session[];
    onDeleteSession: (sessionId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ sessions, onDeleteSession }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'SESSIONS' | 'TEACHERS'>('SESSIONS');

    // Teacher Management State
    const [teachers, setTeachers] = useState<any[]>([]);
    const [tName, setTName] = useState('');
    const [tEmail, setTEmail] = useState('');
    const [tPassword, setTPassword] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

    const loadTeachers = async () => {
        setIsLoadingTeachers(true);
        const { data, error } = await dataService.getAllTeacherProfiles();
        if (data) setTeachers(data);
        setIsLoadingTeachers(false);
    };

    React.useEffect(() => {
        if (activeTab === 'TEACHERS') loadTeachers();
    }, [activeTab]);

    const formatRelativeTime = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diffInSeconds < 60) return 'Vừa xong';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleResetPassword = async (teacherEmail: string) => {
        if (!confirm('Bạn có chắc chắn muốn reset mật khẩu tài khoản này về mặc định (123456)?')) return;
        const res = await dataService.resetTeacherPassword(teacherEmail);
        toast.info(res.message);
    };

    const handleCreateTeacher = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tName || !tEmail || !tPassword) return;
        setIsCreating(true);

        const fullEmail = tEmail.includes('@') ? tEmail : `${tEmail}@edu.vn`;

        const res = await dataService.createTeacherAccount(fullEmail, tPassword, tName);
        setIsCreating(false);
        if (res.success) {
            toast.success(res.message);
            setTName(''); setTEmail(''); setTPassword('');
            loadTeachers();
        } else {
            toast.error('Lỗi: ' + res.message);
        }
    };

    const filteredSessions = sessions.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.teacherName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roomCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                <div className="relative z-10 text-center md:text-left">
                    <div className="flex items-center gap-3 mb-4 justify-center md:justify-start">
                        <div className="bg-indigo-500 p-2 rounded-xl">
                            <LucideShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Hệ thống Quản Trị</span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tight mb-2">Quản Lý Toàn Cầu</h1>
                    <p className="text-slate-400 font-medium max-w-md">Giám sát toàn bộ hoạt động giảng dạy và tài liệu được tải lên hệ thống.</p>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/10 text-center relative z-10 min-w-[200px]">
                    <span className="block text-5xl font-black mb-1">{sessions.length}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tổng số bài giảng</span>
                </div>
            </div>

            <div className="flex gap-4 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('SESSIONS')}
                    className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'SESSIONS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Bài giảng
                </button>
                <button
                    onClick={() => setActiveTab('TEACHERS')}
                    className={`pb-4 px-2 text-sm font-black uppercase tracking-widest transition-all border-b-4 ${activeTab === 'TEACHERS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Giáo viên
                </button>
            </div>

            {activeTab === 'SESSIONS' ? (
                <>
                    <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div className="relative w-full md:max-w-md">
                            <LucideSearch className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên bài, giáo viên hoặc mã phòng..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {filteredSessions.map((session) => (
                            <div key={session.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 flex flex-col md:flex-row gap-8 hover:shadow-xl transition-all group relative overflow-hidden">
                                <div className="w-full md:w-48 aspect-[16/10] bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 border border-slate-800 text-indigo-400">
                                    <LucideMonitor className="w-12 h-12 opacity-50" />
                                </div>

                                <div className="flex-1 flex flex-col justify-between py-2">
                                    <div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <LucideClock className="w-3 h-3" /> PHÒNG: {session.roomCode}
                                            </span>
                                            <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <LucideUser className="w-3 h-3" /> GV: {session.teacherName}
                                            </span>
                                            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <LucideDatabase className="w-3 h-3" /> {formatSize(session.storageSize)}
                                            </span>
                                            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                                <LucideClock className="w-3 h-3" /> {formatRelativeTime(session.createdAt)}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-2 transition-colors">{session.title}</h3>
                                        <p className="text-slate-500 text-sm font-medium">Bao gồm {session.slides.length} slides và {session.slides.reduce((acc, s) => acc + s.questions.length, 0)} câu hỏi tương tác.</p>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-slate-50 mt-4">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</span>
                                                <span className={`text-sm font-bold ${session.isActive ? 'text-green-500' : 'text-slate-400'}`}>
                                                    {session.isActive ? '● Đang hoạt động' : '○ Đang đóng'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => onDeleteSession(session.id)}
                                            className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                        >
                                            <LucideTrash2 className="w-4 h-4" /> Xóa bài giảng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredSessions.length === 0 && (
                            <div className="text-center py-32 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                                <LucideSearch className="w-16 h-16 text-slate-300 mx-auto mb-6" />
                                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Không tìm thấy bài giảng nào</h3>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm">
                        <h2 className="text-3xl font-black text-slate-900 mb-2">Thêm Giáo Viên Mới</h2>
                        <p className="text-slate-500 font-medium mb-8">Tạo tài khoản chính thức để giáo viên có thể quản lý bài giảng riêng.</p>

                        <form onSubmit={handleCreateTeacher} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Họ và tên giáo viên</label>
                                <input value={tName} onChange={e => setTName(e.target.value)} type="text" placeholder="Nguyễn Văn A" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Tên đăng nhập</label>
                                <input value={tEmail} onChange={e => setTEmail(e.target.value)} type="text" placeholder="gv01" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Mật khẩu mặc định</label>
                                <input value={tPassword} onChange={e => setTPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold" required />
                            </div>

                            <button disabled={isCreating} type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95">
                                {isCreating ? <LucideLoader2 className="animate-spin" /> : 'TẠO TÀI KHOẢN NGAY'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-sm overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-slate-900">Danh Sách Giáo Viên</h2>
                            <button onClick={loadTeachers} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                                <LucideClock className={`w-5 h-5 ${isLoadingTeachers ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                            {teachers.map(teacher => (
                                <div key={teacher.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-all group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-slate-900">{teacher.full_name}</p>
                                            <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                                ID: {teacher.id.substring(0, 8)}...
                                                {teacher.provider === 'google' && (
                                                    <span className="inline-flex items-center gap-1 bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">
                                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" className="w-3 h-3" alt="G" />
                                                        Google Account
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {teacher.provider !== 'google' && (
                                                <button onClick={() => handleResetPassword(teacher.id + "@edu.vn")} title="Reset mật khẩu về mặc định" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                                                    <LucideLock className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all">
                                                <LucideTrash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <LucideDatabase className="w-3 h-3 text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dung lượng: {formatSize(sessions.filter(s => s.teacherId === teacher.id).reduce((acc, s) => acc + (s.storageSize || 0), 0))}</span>
                                        </div>
                                        <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Hoạt động</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
