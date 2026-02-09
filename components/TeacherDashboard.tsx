
import React, { useState, useRef } from 'react';
import { Session, QuestionType, Slide, Question } from '../types';
import { LucidePlus, LucidePlay, LucideSettings, LucideUpload, LucideLoader2, LucideCheckCircle, LucideLayers, LucideMessageSquarePlus, LucideX, LucideTrash2, LucideClock, LucideCheck, LucideFileText, LucideImage, LucideArrowRight, LucideMessageSquare, LucideSearch, LucideChevronUp, LucideChevronDown, LucideCopy, LucideSave, LucideUsers } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import PDFSlideRenderer from './PDFSlideRenderer';
import { dataService } from '../services/dataService';
import { toast } from './Toast';
import StudentManager from './StudentManager';
import ApiKeyManager from './ApiKeyManager';

const MAX_IMAGE_DIMENSION = 1920;
const MAX_FILE_SIZE_MB = 10;

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
  teacherId: string;
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ sessions, onStart, onAddSession, onDeleteSession, teacherId }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [replacingSlideId, setReplacingSlideId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'inactive'>('all');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<number | null>(null);
  const [showStudentManager, setShowStudentManager] = useState(false);
  const [showApiKeyManager, setShowApiKeyManager] = useState(false);

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

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_IMAGE_DIMENSION;
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = (width / height) * MAX_IMAGE_DIMENSION;
            height = MAX_IMAGE_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Constant quality for faster processing
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Compression failed'));
          resolve(blob);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Image failed to load'));
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;
    setIsUpdatingPassword(true);
    const res = await dataService.updateMyPassword(newPassword);
    setIsUpdatingPassword(false);
    if (res.success) {
      toast.success(res.message);
      setNewPassword('');
    } else {
      toast.error('Lỗi: ' + res.message);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (files.length === 1 && files[0].type === 'application/pdf') {
        const file = files[0];
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          toast.warning(`File PDF quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn file dưới ${MAX_FILE_SIZE_MB}MB.`);
          setIsUploading(false);
          return;
        }
        setUploadProgress(10);
        const publicUrl = await dataService.uploadPDF(file);
        if (!publicUrl) throw new Error("Upload failed");
        setUploadProgress(40);

        const loadingTask = pdfjs.getDocument({ url: publicUrl });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        setUploadProgress(70);

        let roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
        let isUnique = await dataService.isRoomCodeUnique(roomCode);
        while (!isUnique) {
          roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
          isUnique = await dataService.isRoomCodeUnique(roomCode);
        }

        const newSession: Session = {
          id: crypto.randomUUID(),
          roomCode: roomCode,
          title: file.name.replace(/\.[^/.]+$/, ""),
          currentSlideIndex: 0,
          isActive: true,
          responses: [],
          activeQuestionId: null,
          storageSize: file.size,
          createdAt: new Date().toISOString(),
          slides: Array.from({ length: numPages }).map((_, i) => ({
            id: crypto.randomUUID(),
            title: `Slide ${i + 1}`,
            content: '',
            imageUrl: '',
            pdfSource: publicUrl,
            pdfPage: i + 1,
            questions: []
          }))
        };

        const success = await dataService.createSession(newSession, newSession.slides);
        if (success) {
          onAddSession(newSession);
          setUploadProgress(100);
        }
      } else {
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return;

        // Check if any file is too large (> 10MB)
        const oversized = imageFiles.find(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
        if (oversized) {
          toast.warning(`File "${oversized.name}" quá lớn (${(oversized.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn file dưới ${MAX_FILE_SIZE_MB}MB.`);
          return;
        }

        let roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
        let isUnique = await dataService.isRoomCodeUnique(roomCode);
        while (!isUnique) {
          roomCode = Math.random().toString(36).substr(2, 4).toUpperCase();
          isUnique = await dataService.isRoomCodeUnique(roomCode);
        }

        setUploadProgress(10);
        let completed = 0;

        const slideSlots: (Slide | null)[] = new Array(imageFiles.length).fill(null);
        let totalSize = 0;

        // Process in parallel
        await Promise.all(imageFiles.map(async (file, i) => {
          try {
            const compressedBlob = await compressImage(file);
            const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

            const publicUrl = await dataService.uploadPDF(compressedFile);
            if (publicUrl) {
              slideSlots[i] = {
                id: crypto.randomUUID(),
                title: `Slide ${i + 1}`,
                content: '',
                imageUrl: publicUrl,
                questions: []
              };
              totalSize += compressedFile.size;
            }
          } catch (err) {
            console.error("Error processing file", i, err);
          } finally {
            completed++;
            setUploadProgress(Math.round(10 + (completed / imageFiles.length) * 80));
          }
        }));

        const slides = slideSlots.filter((s): s is Slide => s !== null);

        if (slides.length > 0) {
          const newSession: Session = {
            id: crypto.randomUUID(),
            roomCode: roomCode,
            title: imageFiles.length > 1 ? `Bài giảng mới (${imageFiles.length} ảnh)` : imageFiles[0].name.replace(/\.[^/.]+$/, ""),
            currentSlideIndex: 0,
            isActive: true,
            responses: [],
            activeQuestionId: null,
            storageSize: totalSize,
            createdAt: new Date().toISOString(),
            slides: slides
          };

          const success = await dataService.createSession(newSession, slides);
          if (success) {
            onAddSession(newSession);
            setUploadProgress(100);
          }
        }
      }
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('Có lỗi xảy ra trong quá trình tải lên. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    updatedSlides[slideIndex].questions = [...updatedSlides[slideIndex].questions, newQuestion];
    setEditingSession({ ...editingSession, slides: updatedSlides });
  };

  const updateQuestion = (slideIndex: number, questionIndex: number, data: Partial<Question>) => {
    if (!editingSession) return;
    const updatedSlides = [...editingSession.slides];
    updatedSlides[slideIndex].questions[questionIndex] = { ...updatedSlides[slideIndex].questions[questionIndex], ...data };
    setEditingSession({ ...editingSession, slides: updatedSlides });
  };

  const removeQuestion = (slideIndex: number, questionIndex: number) => {
    if (!editingSession) return;
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    const updatedSlides = [...editingSession.slides];
    updatedSlides[slideIndex].questions = updatedSlides[slideIndex].questions.filter((_, i) => i !== questionIndex);
    const updated = { ...editingSession, slides: updatedSlides };
    setEditingSession(updated);
    triggerAutoSave(updated);
  };

  const handleTF4CorrectToggle = (slideIdx: number, qIdx: number, itemIdx: number, value: string) => {
    if (!editingSession) return;
    const currentQuestion = editingSession.slides[slideIdx].questions[qIdx];
    const currentCorrect = (currentQuestion.correctAnswer as Record<number, string>) || {};
    const newCorrect = { ...currentCorrect, [itemIdx]: value };
    updateQuestion(slideIdx, qIdx, { correctAnswer: newCorrect });
  };

  const handleDeleteSlide = async (slideId: string, idx: number) => {
    if (!editingSession) return;
    if (editingSession.slides.length <= 1) {
      toast.warning("Mỗi bài giảng phải có ít nhất 1 slide.");
      return;
    }
    if (!window.confirm("Bạn có chắc chắn muốn xóa slide này?")) return;

    try {
      const success = await dataService.deleteSlide(slideId);
      if (success) {
        const updatedSlides = editingSession.slides.filter((_, i) => i !== idx);
        setEditingSession({ ...editingSession, slides: updatedSlides });
        toast.success('Xóa slide thành công');
      } else {
        toast.error("Xóa slide thất bại.");
      }
    } catch (err) {
      console.error("Delete slide error:", err);
    }
  };

  // --- Slide Reorder ---
  const moveSlide = (fromIdx: number, direction: 'up' | 'down') => {
    if (!editingSession) return;
    const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= editingSession.slides.length) return;
    const updatedSlides = [...editingSession.slides];
    [updatedSlides[fromIdx], updatedSlides[toIdx]] = [updatedSlides[toIdx], updatedSlides[fromIdx]];
    setEditingSession({ ...editingSession, slides: updatedSlides });
    // Update order_index in DB
    updatedSlides.forEach((s, i) => dataService.updateSlide(s.id, { order_index: i }));
  };

  // --- Duplicate Slide ---
  const duplicateSlide = async (slide: Slide, idx: number) => {
    if (!editingSession) return;
    const newSlide = await dataService.createSlide(editingSession.id, {
      title: slide.title,
      content: slide.content,
      imageUrl: slide.imageUrl,
      pdfSource: slide.pdfSource,
      pdfPage: slide.pdfPage,
      questions: slide.questions.map(q => ({ ...q, id: crypto.randomUUID() })),
      order_index: idx + 1
    });
    if (newSlide) {
      const updatedSlides = [...editingSession.slides];
      updatedSlides.splice(idx + 1, 0, newSlide);
      setEditingSession({ ...editingSession, slides: updatedSlides });
      toast.success('Nhân bản slide thành công');
    }
  };

  // --- Auto-save debounce ---
  const triggerAutoSave = (session: Session) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setAutoSaveStatus('saving');
    autoSaveTimerRef.current = window.setTimeout(async () => {
      for (const slide of session.slides) {
        await dataService.updateSlide(slide.id, { questions: slide.questions });
      }
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 1500);
  };

  // --- Filtered sessions ---
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.roomCode.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === 'active') return matchesSearch && s.isActive !== false;
    if (filterMode === 'inactive') return matchesSearch && s.isActive === false;
    return matchesSearch;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Header section */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">DANH SÁCH BÀI GIẢNG</h1>
          <p className="text-slate-500 font-medium">Quản lý slide và gắn câu hỏi tương tác có đếm ngược thời gian.</p>
        </div>
        <div className="flex gap-4">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,image/*" multiple className="hidden" />
          {isUploading && (
            <div className="flex flex-col items-end justify-center min-w-[200px] gap-2">
              <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest italic animate-pulse">
                <LucideLoader2 className="w-4 h-4 animate-spin" />
                Đang xử lý... {uploadProgress}%
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <button onClick={() => setShowStudentManager(true)} className="flex items-center gap-2 p-5 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-all font-bold text-sm">
            <LucideUsers className="w-5 h-5" /> HS
          </button>
          <button onClick={() => setShowApiKeyManager(true)} className="flex items-center gap-2 p-5 bg-amber-50 text-amber-700 rounded-2xl hover:bg-amber-100 transition-all font-bold text-sm">
            🔑 KEY
          </button>
          <button onClick={() => setShowSettings(true)} className="p-5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">
            <LucideSettings className="w-6 h-6" />
          </button>
          <button disabled={isUploading} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:grayscale">
            <LucideUpload className="w-5 h-5" />
            <span>TẢI SLIDE MỚI (PDF/ẢNH)</span>
          </button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <LucideSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm bài giảng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-indigo-600 outline-none transition-colors"
          />
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-100">
          {(['all', 'active', 'inactive'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {mode === 'all' ? 'Tất cả' : mode === 'active' ? 'Đang hoạt động' : 'Lịch sử'}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <div className="bg-white rounded-[3rem] border-2 border-dashed border-slate-200 p-16 text-center">
          <div className="inline-block p-6 bg-indigo-50 rounded-full mb-6">
            <LucideLayers className="w-12 h-12 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-black text-slate-700 mb-2">
            {searchQuery ? 'Không tìm thấy bài giảng' : 'Chưa có bài giảng nào'}
          </h3>
          <p className="text-slate-400 font-medium mb-6">
            {searchQuery ? `Không có kết quả cho "${searchQuery}"` : 'Tải lên PDF hoặc ảnh để tạo bài giảng đầu tiên của bạn!'}
          </p>
          {!searchQuery && (
            <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl active:scale-95 inline-flex items-center gap-3">
              <LucideUpload className="w-5 h-5" /> TẢI SLIDE ĐẦU TIÊN
            </button>
          )}
        </div>
      )}

      {/* Grid section - Active Sessions */}
      {filteredSessions.filter(s => s.isActive !== false).length > 0 && (
        <>
          <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tight flex items-center gap-2">
            <LucidePlay className="w-6 h-6 text-indigo-600" /> Bài giảng đang hoạt động
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-12">
            {filteredSessions.filter(s => s.isActive !== false).map((session) => (
              <div key={session.id} className="group bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500">
                <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                  {session.slides[0]?.pdfSource ? (
                    <div className="w-full h-full scale-110">
                      <PDFSlideRenderer url={session.slides[0].pdfSource} pageNumber={session.slides[0].pdfPage || 1} width={400} />
                    </div>
                  ) : (
                    <img src={session.slides[0]?.imageUrl} className="w-full h-full object-cover" alt="Thumb" />
                  )}
                  <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-xl text-white font-black text-xs tracking-widest">
                    {session.roomCode}
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="font-bold text-slate-900 line-clamp-1">{session.title}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase">Hoạt động</span>
                  </div>
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
                    <button
                      disabled={startingSessionId !== null}
                      onClick={async () => {
                        setStartingSessionId(session.id);
                        try {
                          await onStart(session);
                        } finally {
                          setStartingSessionId(null);
                        }
                      }}
                      className={`flex-1 ${startingSessionId === session.id ? 'bg-indigo-400' : 'bg-slate-900 hover:bg-indigo-600'} text-white py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
                    >
                      {startingSessionId === session.id ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucidePlay className="w-4 h-4" />}
                      {startingSessionId === session.id ? 'ĐANG TẢI...' : 'TRÌNH CHIẾU'}
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
        </>
      )}

      {/* History Section - Inactive Sessions */}
      {filteredSessions.filter(s => s.isActive === false).length > 0 && (
        <div className="animate-in slide-in-from-bottom-10 fade-in duration-500">
          <h3 className="text-xl font-black text-slate-400 mb-6 uppercase tracking-tight flex items-center gap-2">
            <LucideClock className="w-6 h-6" /> Lịch sử phiên học
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 opacity-75 hover:opacity-100 transition-opacity">
            {filteredSessions.filter(s => s.isActive === false).map((session) => (
              <div key={session.id} className="group bg-slate-50 rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-700 line-clamp-1">{session.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="bg-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase">Kết thúc</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {formatRelativeTime(session.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span className="flex items-center gap-1"><LucideLayers className="w-3 h-3" /> {session.slides.length} slides</span>
                        <span className="flex items-center gap-1"><LucideMessageSquarePlus className="w-3 h-3" /> {session.slides.reduce((a, s) => a + s.questions.length, 0)} câu hỏi</span>
                      </div>
                    </div>
                    <div className="bg-slate-200 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500">
                      {session.roomCode}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toast.info("Tính năng xem báo cáo chi tiết đang được phát triển!")}
                      className="flex-1 bg-white border border-slate-200 text-indigo-600 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:bg-indigo-50"
                    >
                      <LucideFileText className="w-4 h-4" /> XEM BÁO CÁO
                    </button>
                    <button onClick={() => onDeleteSession(session.id)} className="p-3 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl border border-slate-200 transition-colors">
                      <LucideTrash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Thiết lập bài giảng</h2>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500 font-medium">Tùy chỉnh thông tin và câu hỏi tương tác.</p>
                  {autoSaveStatus === 'saving' && <span className="text-[10px] font-black text-amber-500 flex items-center gap-1 animate-pulse"><LucideLoader2 className="w-3 h-3 animate-spin" /> Đang lưu...</span>}
                  {autoSaveStatus === 'saved' && <span className="text-[10px] font-black text-green-500 flex items-center gap-1"><LucideCheckCircle className="w-3 h-3" /> Đã lưu</span>}
                </div>
              </div>
              <button
                onClick={async () => {
                  await dataService.updateSession(editingSession.id, {
                    title: editingSession.title,
                    roomCode: editingSession.roomCode
                  });
                  setEditingSession(null);
                }}
                className="p-3 hover:bg-slate-200 rounded-2xl transition-colors"
              >
                <LucideX />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              <div className="bg-indigo-50/50 p-8 rounded-[2rem] border-2 border-indigo-100 flex flex-col md:flex-row gap-8 items-end">
                <div className="flex-1 space-y-4">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Thông tin cơ bản</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 ml-1">Tiêu đề bài giảng</label>
                      <input
                        type="text"
                        value={editingSession.title}
                        onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })}
                        className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 ml-1">Mã phòng (Phòng riêng)</label>
                      <input
                        type="text"
                        value={editingSession.roomCode}
                        onChange={(e) => setEditingSession({ ...editingSession, roomCode: e.target.value.toUpperCase() })}
                        className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 font-black text-indigo-600 outline-none focus:border-indigo-500 transition-colors shadow-sm tracking-widest"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Nội dung Slide & Câu hỏi</h4>
                {editingSession.slides.map((slide, idx) => (
                  <div key={slide.id} className="bg-white rounded-[2rem] border-2 border-slate-100 p-6 flex flex-col lg:flex-row gap-8 hover:border-indigo-100 transition-colors shadow-sm">
                    <div className="w-full lg:w-72 space-y-4 shrink-0">
                      <div className="aspect-video rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50 relative group">
                        {slide.imageUrl ? (
                          <img src={slide.imageUrl} className="w-full h-full object-cover" alt="Slide" />
                        ) : slide.pdfSource ? (
                          <div className="w-full h-full scale-125 origin-center capitalize">
                            <PDFSlideRenderer url={slide.pdfSource} pageNumber={slide.pdfPage || 1} width={300} />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <LucideImage className="w-10 h-10" />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          {replacingSlideId === slide.id ? (
                            <div className="bg-white/90 p-3 rounded-2xl flex items-center gap-2">
                              <LucideLoader2 className="w-5 h-5 animate-spin text-indigo-600" />
                              <span className="text-[10px] font-black text-indigo-600">ĐANG TẢI...</span>
                            </div>
                          ) : (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setReplacingSlideId(slide.id);
                                  try {
                                    const compressed = await compressImage(file);
                                    const cFile = new File([compressed], file.name, { type: 'image/jpeg' });
                                    const url = await dataService.uploadPDF(cFile);
                                    if (url) {
                                      const updatedSlides = [...editingSession.slides];
                                      updatedSlides[idx] = { ...updatedSlides[idx], imageUrl: url, pdfSource: undefined };
                                      setEditingSession({ ...editingSession, slides: updatedSlides });
                                      await dataService.updateSlide(slide.id, { imageUrl: url, pdfSource: null as any });
                                    }
                                  } catch (err) {
                                    toast.error("Lỗi khi thay ảnh. Vui lòng thử lại.");
                                  } finally {
                                    setReplacingSlideId(null);
                                  }
                                }}
                              />
                              <div className="bg-white px-4 py-2 rounded-xl text-xs font-black shadow-xl flex items-center gap-2">
                                <LucideUpload className="w-4 h-4" /> ĐỔI ẢNH
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-black text-slate-300 uppercase">Slide {idx + 1}</span>
                        {slide.pdfPage && <span className="text-[10px] font-black text-indigo-400">PDF PAGE {slide.pdfPage}</span>}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="bg-slate-900 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Câu hỏi ({slide.questions.length})</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveSlide(idx, 'up')} disabled={idx === 0} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-all" title="Di chuyển lên">
                            <LucideChevronUp className="w-4 h-4" />
                          </button>
                          <button onClick={() => moveSlide(idx, 'down')} disabled={idx === editingSession.slides.length - 1} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-20 transition-all" title="Di chuyển xuống">
                            <LucideChevronDown className="w-4 h-4" />
                          </button>
                          <button onClick={() => duplicateSlide(slide, idx)} className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded-lg transition-all" title="Nhân bản slide">
                            <LucideCopy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSlide(slide.id, idx)}
                            title="Xóa Slide này"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <LucideTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question List */}
                      {slide.questions.map((q, qIdx) => (
                        <div key={q.id} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Câu {qIdx + 1}</span>
                            <button
                              onClick={() => removeQuestion(idx, qIdx)}
                              title="Xóa câu hỏi này"
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <LucideTrash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Question Type Selector */}
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
                                  updateQuestion(idx, qIdx, {
                                    type: type.id as QuestionType,
                                    options: newOptions,
                                    correctAnswer: type.id === QuestionType.TRUE_FALSE_4 ? {} : null
                                  });
                                }}
                                className={`py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border-2 ${q.type === type.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>

                          {/* Prompt + Duration */}
                          <div className="flex gap-3">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={q.prompt}
                                onChange={(e) => updateQuestion(idx, qIdx, { prompt: e.target.value })}
                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none text-sm"
                                placeholder="Câu hỏi là gì?"
                              />
                            </div>
                            <div className="w-24">
                              <input
                                type="number"
                                value={q.duration}
                                onChange={(e) => updateQuestion(idx, qIdx, { duration: parseInt(e.target.value) || 0 })}
                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-3 py-2.5 font-black text-indigo-600 text-center outline-none text-sm"
                                placeholder="Giây"
                              />
                            </div>
                          </div>

                          {/* MCQ / TF Options */}
                          {(q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) && (
                            <div className={`grid gap-2 ${q.type === QuestionType.TRUE_FALSE ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
                              {(q.options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="relative flex items-center gap-2">
                                  <button
                                    onClick={() => updateQuestion(idx, qIdx, { correctAnswer: opt })}
                                    className={`p-1.5 rounded-lg border-2 transition-all ${q.correctAnswer === opt ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-slate-200 text-slate-300'}`}
                                  >
                                    <LucideCheck className="w-3.5 h-3.5" />
                                  </button>
                                  <input
                                    type="text"
                                    value={opt}
                                    readOnly={q.type === QuestionType.TRUE_FALSE}
                                    onChange={(e) => {
                                      const newOpts = [...(q.options || [])];
                                      newOpts[optIdx] = e.target.value;
                                      updateQuestion(idx, qIdx, { options: newOpts });
                                    }}
                                    className={`flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none ${q.type === QuestionType.TRUE_FALSE ? 'bg-slate-50 cursor-default' : ''}`}
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Short Answer */}
                          {q.type === QuestionType.SHORT_ANSWER && (
                            <div>
                              <input
                                type="text"
                                value={q.correctAnswer || ''}
                                onChange={(e) => updateQuestion(idx, qIdx, { correctAnswer: e.target.value })}
                                className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none text-sm focus:border-indigo-500"
                                placeholder="Đáp án đúng (ví dụ: 42 hoặc Hydrogen)..."
                              />
                            </div>
                          )}

                          {/* TF4 Options */}
                          {q.type === QuestionType.TRUE_FALSE_4 && (
                            <div className="grid grid-cols-1 gap-2">
                              {(q.options || []).map((opt, optIdx) => (
                                <div key={optIdx} className="flex flex-col sm:flex-row gap-2 items-center bg-white p-3 rounded-xl border border-slate-100">
                                  <span className="font-black text-slate-400 text-xs w-6 text-center">{optIdx + 1}</span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...(q.options || [])];
                                      newOpts[optIdx] = e.target.value;
                                      updateQuestion(idx, qIdx, { options: newOpts });
                                    }}
                                    className="flex-1 bg-slate-50 px-3 py-1.5 rounded-lg font-bold text-sm outline-none border border-slate-100"
                                    placeholder={`Ý khẳng định ${optIdx + 1}...`}
                                  />
                                  <div className="flex gap-1.5 shrink-0">
                                    {['Đúng', 'Sai'].map(val => (
                                      <button
                                        key={val}
                                        onClick={() => handleTF4CorrectToggle(idx, qIdx, optIdx, val)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black border-2 transition-all ${(q.correctAnswer as any)?.[optIdx] === val
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
                          )}
                        </div>
                      ))}

                      {/* Add Question Button */}
                      <button
                        onClick={() => addQuestionToSlide(idx)}
                        className="w-full border-2 border-dashed border-slate-200 rounded-2xl py-4 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
                      >
                        <LucidePlus className="w-4 h-4" /> Thêm câu hỏi
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add Blank Slide Button */}
                <button
                  onClick={async () => {
                    const newSlide = await dataService.createSlide(editingSession.id, {
                      title: `Slide ${editingSession.slides.length + 1}`,
                      content: '',
                      questions: [],
                      order_index: editingSession.slides.length
                    });
                    if (newSlide) {
                      setEditingSession({
                        ...editingSession,
                        slides: [...editingSession.slides, newSlide]
                      });
                    }
                  }}
                  className="w-full border-2 border-dashed border-indigo-200 rounded-[2rem] py-8 text-indigo-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3"
                >
                  <LucidePlus className="w-6 h-6" /> Thêm Slide mới
                </button>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50/50 flex justify-end gap-4">
              <button
                onClick={() => setEditingSession(null)}
                className="px-6 py-4 bg-slate-200 text-slate-600 rounded-2xl font-black"
              >
                HỦY
              </button>
              <button
                disabled={isSaving}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    // 1. Update session metadata
                    await dataService.updateSession(editingSession.id, {
                      title: editingSession.title,
                      roomCode: editingSession.roomCode
                    });

                    // 2. Batch update slides (mostly for questions and ORDER)
                    const slideUpdates = editingSession.slides.map((s, index) =>
                      dataService.updateSlide(s.id, {
                        questions: s.questions,
                        title: s.title,
                        content: s.content,
                        order_index: index // PERSIST ORDER
                      })
                    );
                    await Promise.all(slideUpdates);

                    setEditingSession(null);
                    toast.success("Đã lưu cấu hình thành công!");
                  } catch (err) {
                    console.error("Save error:", err);
                    toast.error("Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg flex items-center gap-2"
              >
                {isSaving ? <LucideLoader2 className="animate-spin" /> : 'LƯU CẤU HÌNH'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
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

      {showStudentManager && (
        <StudentManager teacherId={teacherId} onClose={() => setShowStudentManager(false)} />
      )}
      {showApiKeyManager && (
        <ApiKeyManager onClose={() => setShowApiKeyManager(false)} />
      )}
    </div>
  );
};

export default TeacherDashboard;
