
import React, { useState, useRef } from 'react';
import { Session, QuestionType, Slide, Question } from '../types';
import { LucidePlus, LucidePlay, LucideSettings, LucideUpload, LucideLoader2, LucideCheckCircle, LucideLayers, LucideMessageSquarePlus, LucideX, LucideTrash2, LucideClock, LucideCheck, LucideFileText } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import PDFSlideRenderer from './PDFSlideRenderer';
import { dataService } from '../services/dataService';

// Configure worker for TeacherDashboard
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface TeacherDashboardProps {
  sessions: Session[];
  onStart: (session: Session) => void;
  onAddSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ sessions, onStart, onAddSession, onDeleteSession }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setIsUpdatingPassword(true);
    const res = await dataService.updateMyPassword(newPassword);
    setIsUpdatingPassword(false);
    if (res.success) {
      alert(res.message);
      setNewPassword('');
    } else {
      alert('Lỗi: ' + res.message);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(10);

      // 1. Upload to Supabase Storage
      const publicUrl = await dataService.uploadPDF(file);
      if (!publicUrl) throw new Error("Upload failed");

      setUploadProgress(40);

      // 2. Read PDF for pages
      const loadingTask = pdfjs.getDocument({ url: publicUrl });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      setUploadProgress(70);

      // 3. Generate a UNIQUE Room Code (4 characters)
      let roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
      let isUnique = await dataService.isRoomCodeUnique(roomCode);
      while (!isUnique) {
        roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
        isUnique = await dataService.isRoomCodeUnique(roomCode);
      }

      const newSession: Session = {
        id: crypto.randomUUID(), // Use UUID
        roomCode: roomCode,
        title: file.name.replace(/\.[^/.]+$/, ""),
        currentSlideIndex: 0,
        isActive: true,
        responses: [],
        activeQuestionId: null,
        storageSize: file.size,
        createdAt: new Date().toISOString(),
        slides: Array.from({ length: numPages }).map((_, i) => ({
          id: crypto.randomUUID(), // Use UUID
          title: `Slide ${i + 1}`,
          content: '',
          imageUrl: '',
          pdfSource: publicUrl,
          pdfPage: i + 1,
          questions: []
        }))
      };

      setUploadProgress(100);
      setTimeout(() => {
        onAddSession(newSession);
        setIsUploading(false);
      }, 500);

    } catch (error: any) {
      console.error("Error reading PDF:", error);
      alert(`Lỗi đọc file PDF: ${error.message || "Vui lòng thử lại."}`);
      setIsUploading(false);
    }
  };

  const completeUpload = (file: File) => {
    // Legacy function, replaced by handleFileUpload logic directly
  };

  const addQuestionToSlide = (slideIndex: number) => {
    if (!editingSession) return;
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      slideIndex,
      type: QuestionType.MULTIPLE_CHOICE,
      prompt: 'Nhập nội dung câu hỏi...',
      options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
      duration: 30,
      correctAnswer: null
    };

    const updatedSlides = [...editingSession.slides];
    updatedSlides[slideIndex].questions = [newQuestion];
    setEditingSession({ ...editingSession, slides: updatedSlides });
  };

  const updateQuestion = (slideIndex: number, data: Partial<Question>) => {
    if (!editingSession) return;
    const updatedSlides = [...editingSession.slides];
    updatedSlides[slideIndex].questions[0] = { ...updatedSlides[slideIndex].questions[0], ...data };
    setEditingSession({ ...editingSession, slides: updatedSlides });
  };

  const removeQuestion = (slideIndex: number) => {
    if (!editingSession) return;
    const updatedSlides = [...editingSession.slides];
    updatedSlides[slideIndex].questions = [];
    setEditingSession({ ...editingSession, slides: updatedSlides });
  };

  const handleTF4CorrectToggle = (slideIdx: number, itemIdx: number, value: string) => {
    if (!editingSession) return;
    const currentQuestion = editingSession.slides[slideIdx].questions[0];
    const currentCorrect = (currentQuestion.correctAnswer as Record<number, string>) || {};
    const newCorrect = { ...currentCorrect, [itemIdx]: value };
    updateQuestion(slideIdx, { correctAnswer: newCorrect });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Thư viện bài giảng</h1>
          <p className="text-slate-500 font-medium">Quản lý slide và gắn câu hỏi tương tác có đếm ngược thời gian.</p>
        </div>
        <div className="flex gap-4">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" className="hidden" />
          <button onClick={() => setShowSettings(true)} className="p-5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">
            <LucideSettings className="w-6 h-6" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95">
            <LucideUpload className="w-5 h-5" />
            <span>TẢI SLIDE MỚI</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {sessions.map((session) => (
          <div key={session.id} className="group bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500">
            <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
              {session.slides[0]?.pdfSource ? (
                <div className="w-full h-full">
                  <PDFSlideRenderer url={session.slides[0].pdfSource} pageNumber={session.slides[0].pdfPage || 1} width={400} />
                </div>
              ) : (
                <img src={session.slides[0]?.imageUrl} className="w-full h-full object-cover" alt="Thumb" />
              )}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-xl text-white font-black text-xs">
                {session.roomCode}
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="font-bold text-slate-900 line-clamp-1">{session.title}</h3>
              <div className="flex flex-col gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1"><LucideLayers className="w-4 h-4" /> {session.slides.length} SLIDES</span>
                  <span className="flex items-center gap-1"><LucideMessageSquarePlus className="w-4 h-4" /> {session.slides.reduce((acc, s) => acc + s.questions.length, 0)} CÂU HỎI</span>
                </div>
                <div className="flex items-center gap-4 text-slate-300">
                  <span className="flex items-center gap-1"><LucideFileText className="w-3 h-3" /> {formatSize(session.storageSize)}</span>
                  <span className="flex items-center gap-1"><LucideClock className="w-3 h-3" /> {formatRelativeTime(session.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => onStart(session)} className="flex-1 bg-slate-900 hover:bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2">
                  <LucidePlay className="w-4 h-4" /> TRÌNH CHIẾU
                </button>
                <button onClick={() => setEditingSession(session)} className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors">
                  <LucideSettings className="w-5 h-5" />
                </button>
                <button onClick={() => onDeleteSession(session.id)} className="p-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-100 transition-colors">
                  <LucideTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Thiết lập câu hỏi tương tác</h2>
                <p className="text-sm text-slate-500 font-medium">Tùy chỉnh thời gian và đáp án đúng cho từng slide.</p>
              </div>
              <button onClick={() => setEditingSession(null)} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors"><LucideX /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {editingSession.slides.map((slide, idx) => (
                <div key={slide.id} className="bg-white rounded-[2rem] border-2 border-slate-100 p-6 flex flex-col md:flex-row gap-8 hover:border-indigo-100 transition-colors">
                  <div className="w-full md:w-64 aspect-video rounded-2xl overflow-hidden shrink-0 border shadow-sm bg-slate-100">
                    {slide.pdfSource ? (
                      <div className="w-full h-full relative">
                        <div className="absolute inset-0 pointer-events-none">
                          <PDFSlideRenderer url={slide.pdfSource} pageNumber={slide.pdfPage || 1} width={256} />
                        </div>
                      </div>
                    ) : (
                      <img src={slide.imageUrl} className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="bg-slate-900 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Slide {idx + 1}</span>
                      {slide.questions.length > 0 && (
                        <button onClick={() => removeQuestion(idx)} className="text-red-400 hover:text-red-600 transition-colors"><LucideTrash2 className="w-5 h-5" /></button>
                      )}
                    </div>

                    {slide.questions.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: QuestionType.MULTIPLE_CHOICE, label: 'Trắc nghiệm' },
                            { id: QuestionType.TRUE_FALSE, label: 'Đúng/Sai' },
                            { id: QuestionType.TRUE_FALSE_4, label: 'Đúng/Sai 4 ý' },
                            { id: QuestionType.SHORT_ANSWER, label: 'Trả lời ngắn' }
                          ].map(type => (
                            <button
                              key={type.id}
                              onClick={() => {
                                let newOptions = ['Lựa chọn 1', 'Lựa chọn 2', 'Lựa chọn 3', 'Lựa chọn 4'];
                                if (type.id === QuestionType.TRUE_FALSE) newOptions = ['Đúng', 'Sai'];
                                if (type.id === QuestionType.TRUE_FALSE_4) newOptions = ['', '', '', ''];

                                updateQuestion(idx, {
                                  type: type.id as QuestionType,
                                  options: newOptions,
                                  correctAnswer: type.id === QuestionType.TRUE_FALSE_4 ? {} : null
                                });
                              }}
                              className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${slide.questions[0].type === type.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Nội dung câu hỏi</label>
                            <input
                              type="text"
                              value={slide.questions[0].prompt}
                              onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none"
                              placeholder="Câu hỏi là gì?"
                            />
                          </div>
                          <div className="w-32">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1"><LucideClock className="w-3 h-3" /> Giây</label>
                            <input
                              type="number"
                              value={slide.questions[0].duration}
                              onChange={(e) => updateQuestion(idx, { duration: parseInt(e.target.value) || 0 })}
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-black text-indigo-600 text-center outline-none"
                            />
                          </div>
                        </div>

                        {(slide.questions[0].type === QuestionType.MULTIPLE_CHOICE || slide.questions[0].type === QuestionType.TRUE_FALSE) && (
                          <div className={`grid gap-3 ${slide.questions[0].type === QuestionType.TRUE_FALSE ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                            {(slide.questions[0].options || []).map((opt, optIdx) => (
                              <div key={optIdx} className="relative flex items-center gap-2">
                                <button
                                  onClick={() => updateQuestion(idx, { correctAnswer: opt })}
                                  className={`p-2 rounded-lg border-2 transition-all ${slide.questions[0].correctAnswer === opt ? 'bg-green-500 border-green-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-300'}`}
                                >
                                  <LucideCheck className="w-4 h-4" />
                                </button>
                                <input
                                  type="text"
                                  value={opt}
                                  readOnly={slide.questions[0].type === QuestionType.TRUE_FALSE}
                                  onChange={(e) => {
                                    const newOpts = [...(slide.questions[0].options || [])];
                                    newOpts[optIdx] = e.target.value;
                                    updateQuestion(idx, { options: newOpts });
                                  }}
                                  className={`flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none ${slide.questions[0].type === QuestionType.TRUE_FALSE ? 'bg-slate-50 cursor-default' : ''}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {slide.questions[0].type === QuestionType.TRUE_FALSE_4 && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3">
                              {(slide.questions[0].options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="flex flex-col sm:flex-row gap-3 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                  <span className="font-black text-slate-400 text-xs w-8 text-center">{optIdx + 1}</span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...(slide.questions[0].options || [])];
                                      newOpts[optIdx] = e.target.value;
                                      updateQuestion(idx, { options: newOpts });
                                    }}
                                    className="flex-1 bg-white px-3 py-2 rounded-lg font-bold text-sm outline-none border border-slate-200"
                                    placeholder={`Nhập nội dung ý khẳng định ${optIdx + 1}...`}
                                  />
                                  <div className="flex gap-2 shrink-0">
                                    {['Đúng', 'Sai'].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleTF4CorrectToggle(idx, optIdx, val)}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-black border-2 transition-all ${(slide.questions[0].correctAnswer as any)?.[optIdx] === val
                                          ? (val === 'Đúng' ? 'bg-green-500 border-green-500 text-white' : 'bg-red-500 border-red-500 text-white')
                                          : 'bg-white border-slate-200 text-slate-400'
                                          }`}
                                      >
                                        {val.toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => addQuestionToSlide(idx)}
                        className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-8 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                      >
                        <LucidePlus className="w-5 h-5" /> Gắn câu hỏi cho Slide này
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex justify-end">
              <button onClick={() => setEditingSession(null)} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">LƯU CẤU HÌNH</button>
            </div>
          </div>
        </div>
      )}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">Cài đặt tài khoản</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><LucideX className="w-6 h-6" /></button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Đổi mật khẩu mới</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-indigo-600 outline-none font-bold"
                  required
                />
              </div>

              <button
                disabled={isUpdatingPassword}
                type="submit"
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                {isUpdatingPassword ? <LucideLoader2 className="animate-spin" /> : 'CẬP NHẬT MẬT KHẨU'}
              </button>
            </form>

            <div className="mt-10 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Dung lượng sử dụng</span>
                <span className="text-xs font-black text-indigo-600">
                  {formatSize(sessions.reduce((acc, s) => acc + (s.storageSize || 0), 0))}
                </span>
              </div>
              <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full" style={{ width: '15%' }} />
              </div>
              <p className="mt-2 text-[10px] text-slate-400 font-bold text-center">Giới hạn miễn phí: 1GB</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
