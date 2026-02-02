
import React, { useState, useRef } from 'react';
import { Session, QuestionType, Slide, Question } from '../types';
import { LucidePlus, LucidePlay, LucideSettings, LucideUpload, LucideLoader2, LucideCheckCircle, LucideLayers, LucideMessageSquarePlus, LucideX, LucideTrash2, LucideClock, LucideCheck, LucideFileText, LucideImage, LucideArrowRight } from 'lucide-react';
import { pdfjs } from 'react-pdf';
import PDFSlideRenderer from './PDFSlideRenderer';
import { dataService } from '../services/dataService';

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
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ sessions, onStart, onAddSession, onDeleteSession }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [replacingSlideId, setReplacingSlideId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
      alert(res.message);
      setNewPassword('');
    } else {
      alert('Lỗi: ' + res.message);
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
          isActive: false,
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
          alert(`File "${oversized.name}" quá lớn (${(oversized.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn file dưới ${MAX_FILE_SIZE_MB}MB.`);
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
            isActive: false,
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
      alert('Có lỗi xảy ra trong quá trình tải lên. Vui lòng thử lại.');
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
      {/* Header section */}
      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Thư viện bài giảng</h1>
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
          <button onClick={() => setShowSettings(true)} className="p-5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">
            <LucideSettings className="w-6 h-6" />
          </button>
          <button disabled={isUploading} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-5 rounded-2xl font-black transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:grayscale">
            <LucideUpload className="w-5 h-5" />
            <span>TẢI SLIDE MỚI (PDF/ẢNH)</span>
          </button>
        </div>
      </div>

      {/* Grid section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {sessions.map((session) => (
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
                <button onClick={() => {
                  if (window.confirm('Bạn có chắc chắn muốn xóa bài giảng này?')) {
                    onDeleteSession(session.id);
                  }
                }} className="p-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl border border-red-100 transition-colors">
                  <LucideTrash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Editing Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Thiết lập bài giảng</h2>
                <p className="text-sm text-slate-500 font-medium">Tùy chỉnh thông tin và câu hỏi tương tác.</p>
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
                                    alert("Lỗi khi thay ảnh. Vui lòng thử lại.");
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
                        <span className="bg-slate-900 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Thiết lập câu hỏi</span>
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

                    // 2. Batch update slides (mostly for questions)
                    const slideUpdates = editingSession.slides.map(s =>
                      dataService.updateSlide(s.id, {
                        questions: s.questions,
                        title: s.title,
                        content: s.content
                      })
                    );
                    await Promise.all(slideUpdates);

                    setEditingSession(null);
                    alert("Đã lưu cấu hình thành công!");
                  } catch (err) {
                    console.error("Save error:", err);
                    alert("Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
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
    </div>
  );
};

export default TeacherDashboard;
