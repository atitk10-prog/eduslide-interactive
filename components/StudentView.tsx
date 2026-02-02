
import React, { useState, useEffect, useRef } from 'react';
import { User, Question, QuestionType } from '../types';
import { socket } from '../services/socketEmulator';
import { LucideAlertTriangle, LucideCheck, LucideCheckCircle2, LucideChevronLeft, LucideClock, LucideLayout, LucideMessageSquare, LucideSend, LucideTrophy, LucideUsers, LucideX } from 'lucide-react';
import { dataService } from '../services/dataService';
import { supabase } from '../services/supabase';

interface StudentViewProps { user: User; }

const StudentView: React.FC<StudentViewProps> = ({ user }) => {
  const [roomCode, setRoomCode] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isQuestionActive, setIsQuestionActive] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, any>>({});
  const [shortAnswer, setShortAnswer] = useState('');
  const [tf4Values, setTf4Values] = useState<Record<number, string>>({});
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [studentClass, setStudentClass] = useState('');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [isPresentationStarted, setIsPresentationStarted] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playDing = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }
    audioRef.current.play().catch(() => { });
  };

  useEffect(() => {
    const handleSlideChange = (data: any) => {
      setCurrentSlideIndex(data.slideIndex);
      setIsQuestionActive(false);
      setIsTimeout(false);
    };

    const handleQuestionState = (data: any) => {
      setIsQuestionActive(data.isActive);
      if (data.isActive) {
        setIsTimeout(false);
        setTimeLeft(data.duration || 0);
        setTf4Values({}); // Reset values when new question opens
        setShortAnswer('');
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = window.setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current!);
              setIsQuestionActive(false);
              setIsTimeout(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        if (data.isTimeout) setIsTimeout(true);
      }
    };

    const handleLeaderboardShow = (data: any) => {
      setLeaderboard(data.leaderboard);
    };

    const handleLeaderboardHide = () => {
      setLeaderboard(null);
    };

    const handleSessionEnd = (data: any) => {
      setSessionEnded(true);
      setLeaderboard(data.leaderboard);
      setIsQuestionActive(false);
    };

    const handleSessionStart = (data: any) => {
      setSessionData(data);
      setCurrentSlideIndex(data.currentSlideIndex);
    };

    const handleFeedbackCorrect = () => {
      playDing();
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 3000);
    };

    const handlePresentationStart = () => {
      setIsPresentationStarted(true);
    };

    socket.on('slide:change', handleSlideChange);
    socket.on('question:state', handleQuestionState);
    socket.on('session:start', handleSessionStart);
    socket.on('presentation:start', handlePresentationStart);
    socket.on('leaderboard:show', handleLeaderboardShow);
    socket.on('leaderboard:hide', handleLeaderboardHide);
    socket.on('session:end', handleSessionEnd);
    socket.on('feedback:correct', handleFeedbackCorrect);

    return () => {
      socket.off('slide:change', handleSlideChange);
      socket.off('question:state', handleQuestionState);
      socket.off('session:start', handleSessionStart);
      socket.off('presentation:start', handlePresentationStart);
      socket.off('leaderboard:show', handleLeaderboardShow);
      socket.off('leaderboard:hide', handleLeaderboardHide);
      socket.off('session:end', handleSessionEnd);
      socket.off('feedback:correct', handleFeedbackCorrect);
      socket.leaveRoom();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Postgres Realtime Subscriptions for robustness
  useEffect(() => {
    if (!sessionData?.id) return;

    const channel = supabase.channel(`session_updates_${sessionData.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'edu_sessions',
        filter: `id=eq.${sessionData.id}`
      }, (payload) => {
        const newData = payload.new;

        // Dynamic Update based on DB
        if (newData.current_slide_index !== undefined) {
          setCurrentSlideIndex(newData.current_slide_index);
        }

        if (newData.is_active !== undefined) {
          setIsPresentationStarted(newData.is_active);
        }

        if (newData.active_question_id !== undefined) {
          const isActive = !!newData.active_question_id;
          setIsQuestionActive(isActive);

          if (isActive) {
            // Find question duration from session data if possible
            const q = sessionData.slides[newData.current_slide_index]?.questions.find((q: any) => q.id === newData.active_question_id);
            if (q) setTimeLeft(q.duration || 30);
          }
        }

        if (newData.is_active === false && sessionData.isActive === true) {
          // Might indicate session end or question stop
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionData?.id]);

  const submitAnswer = async (questionId: string, answer: any) => {
    if (submittedAnswers[questionId] || isTimeout) return;
    setSubmittedAnswers(prev => ({ ...prev, [questionId]: answer }));

    const response = {
      sessionId: sessionData?.id || 'sess-1',
      studentName: user.name,
      studentClass: studentClass || 'N/A',
      questionId,
      answer,
      timestamp: Date.now()
    };

    socket.emit('answer:submit', response);
    await dataService.submitResponse(response);
  };

  const handleJoin = async () => {
    if (!roomCode.trim()) return;

    // 1. Find session using dataService (supports Local + Supabase)
    const session = await dataService.getSessionByRoomCode(roomCode);

    if (!session) {
      alert('Không tìm thấy phòng học hoặc phòng đã đóng.');
      return;
    }

    setSessionData(session);
    setCurrentSlideIndex(session.currentSlideIndex || 0);

    if (session.activeQuestionId) {
      setIsQuestionActive(true);
    }

    if (session.isActive) {
      setIsPresentationStarted(true);
    }

    setIsJoined(true);
    socket.joinRoom(roomCode);
    socket.trackPresence({ name: user.name, class: studentClass || 'N/A' });
    socket.emit('session:join', { roomCode, userName: user.name });
  };

  if (!isJoined) {
    return (
      <div className="flex items-center justify-center h-[80vh] p-6">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl w-full max-w-sm border text-center space-y-4">
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tight">Vào lớp học</h2>
          <div className="text-left space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Lớp của bạn</label>
            <input value={studentClass} onChange={e => setStudentClass(e.target.value)} className="w-full text-center text-lg font-bold p-3 border-2 rounded-xl outline-none border-slate-100 focus:border-indigo-600" placeholder="Ví dụ: 9A1" />
          </div>
          <div className="text-left space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Mã phòng</label>
            <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())} className="w-full text-center text-3xl font-black p-4 border-2 rounded-2xl outline-none border-slate-100 focus:border-indigo-600" placeholder="EDU123" />
          </div>
          <button onClick={handleJoin} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95">THAM GIA NGAY</button>
        </div>
      </div>
    );
  }

  const currentSlide = sessionData?.slides[currentSlideIndex];
  const question: Question | undefined = isQuestionActive || isTimeout ? currentSlide?.questions[0] : undefined;

  return (
    <div className="h-full bg-slate-50 flex flex-col font-sans">
      <div className="bg-white p-4 border-b flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <span className="font-black text-indigo-600 truncate max-w-[150px]">{user.name}</span>
        {!sessionEnded && (
          <div className="flex items-center gap-2">
            {isQuestionActive && (
              <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 animate-pulse border border-red-100">
                <LucideClock className="w-3 h-3" /> {timeLeft}s
              </div>
            )}
            <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-tight">Slide {currentSlideIndex + 1}</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-6 flex flex-col items-center overflow-y-auto relative">
        {showFireworks && (
          <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-hidden">
            <div className="text-6xl animate-bounce">✨ 🍯 ✨</div>
            <div className="absolute inset-0 bg-yellow-400/10 animate-pulse" />
          </div>
        )}

        {leaderboard && (
          <div className="absolute inset-0 bg-slate-900/95 z-50 p-6 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <LucideTrophy className="w-12 h-12 text-yellow-400 mb-4 animate-bounce" />
            <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-widest">Bảng Vinh Danh</h2>
            <div className="w-full max-w-sm space-y-2">
              {leaderboard.slice(0, 5).map((s, i) => (
                <div key={i} className={`flex justify-between p-4 rounded-xl ${s.name === user.name ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/10 text-slate-300'}`}>
                  <div className="flex gap-3 items-center">
                    <span className="font-black opacity-50">#{i + 1}</span>
                    <span className="font-bold">{s.name}</span>
                  </div>
                  <span className="font-black">{s.score}</span>
                </div>
              ))}
            </div>
            {sessionEnded && (
              <p className="mt-8 text-slate-400 font-bold text-sm text-center italic">Buổi học đã kết thúc. Hẹn gặp lại bạn!</p>
            )}
          </div>
        )}

        {sessionEnded && !leaderboard ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
            <div className="bg-green-100 text-green-600 p-8 rounded-[2.5rem] shadow-sm">
              <LucideCheckCircle2 className="w-16 h-16" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">BUỔI HỌC KẾT THÚC</h2>
            <p className="text-slate-500 font-medium">Cảm ơn bạn đã tham gia buổi học hôm nay!</p>
          </div>
        ) : question ? (
          <div className="w-full max-w-lg space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-1 bg-indigo-600 transition-all duration-1000" style={{ width: `${(timeLeft / (question.duration || 1)) * 100}%` }} />
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{question.prompt}</h3>
            </div>

            {isTimeout && !submittedAnswers[question.id] && (
              <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700 font-bold animate-in fade-in slide-in-from-top-2">
                <LucideAlertTriangle className="w-5 h-5 shrink-0" /> Đã hết thời gian trả lời!
              </div>
            )}

            <div className="space-y-3">
              {question.type === QuestionType.MULTIPLE_CHOICE && question.options?.map((opt, i) => (
                <button
                  key={i}
                  disabled={!!submittedAnswers[question.id] || isTimeout}
                  onClick={() => submitAnswer(question.id, opt)}
                  className={`w-full p-5 rounded-2xl border-2 text-left font-bold transition-all ${submittedAnswers[question.id] === opt ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 hover:border-indigo-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span className="inline-block w-8 text-indigo-400 group-disabled:text-white/50">{String.fromCharCode(65 + i)}.</span> {opt}
                </button>
              ))}

              {question.type === QuestionType.TRUE_FALSE && (
                <div className="grid grid-cols-2 gap-4">
                  {(question.options || ['Đúng', 'Sai']).map((opt) => (
                    <button
                      key={opt}
                      disabled={!!submittedAnswers[question.id] || isTimeout}
                      onClick={() => submitAnswer(question.id, opt)}
                      className={`h-40 rounded-3xl border-2 font-black text-2xl flex flex-col items-center justify-center gap-4 transition-all ${submittedAnswers[question.id] === opt
                        ? (opt === 'Đúng' ? 'bg-green-600 border-green-600 text-white shadow-xl' : 'bg-red-600 border-red-600 text-white shadow-xl')
                        : 'bg-white border-slate-100 hover:border-indigo-200'
                        } disabled:opacity-50`}
                    >
                      {opt === 'Đúng' ? <LucideCheck className="w-12 h-12" /> : <LucideX className="w-12 h-12" />}
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              {question.type === QuestionType.TRUE_FALSE_4 && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-6">
                    {(question.options || []).map((label, idx) => (
                      <div key={idx} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                        <div className="flex gap-2">
                          <span className="bg-slate-900 text-white w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black shrink-0">{idx + 1}</span>
                          <p className="font-bold text-slate-700 text-sm leading-snug">{label || `Khẳng định số ${idx + 1}`}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {['Đúng', 'Sai'].map(val => (
                            <button
                              key={val}
                              disabled={!!submittedAnswers[question.id] || isTimeout}
                              onClick={() => setTf4Values({ ...tf4Values, [idx]: val })}
                              className={`px-4 py-3 rounded-xl border-2 font-black text-xs flex items-center justify-center gap-2 transition-all ${tf4Values[idx] === val
                                ? (val === 'Đúng' ? 'bg-green-600 border-green-600 text-white' : 'bg-red-600 border-red-600 text-white')
                                : 'bg-slate-50 border-slate-100 text-slate-400'
                                } active:scale-95`}
                            >
                              {val === 'Đúng' ? <LucideCheck className="w-4 h-4" /> : <LucideX className="w-4 h-4" />}
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!submittedAnswers[question.id] && !isTimeout && (
                    <button
                      disabled={Object.keys(tf4Values).length < 4}
                      onClick={() => submitAnswer(question.id, tf4Values)}
                      className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-50 transition-all hover:bg-indigo-700 active:scale-95"
                    >
                      <LucideSend className="w-5 h-5" />
                      GỬI TẤT CẢ ĐÁP ÁN
                    </button>
                  )}
                </div>
              )}

              {question.type === QuestionType.SHORT_ANSWER && (
                <div className="space-y-4">
                  <textarea
                    value={shortAnswer}
                    onChange={e => setShortAnswer(e.target.value)}
                    disabled={!!submittedAnswers[question.id] || isTimeout}
                    className="w-full p-6 rounded-3xl border-2 border-slate-100 focus:border-indigo-600 h-40 outline-none font-bold text-slate-700 shadow-sm disabled:bg-slate-50"
                    placeholder="Gõ câu trả lời của bạn vào đây..."
                  />
                  {!submittedAnswers[question.id] && !isTimeout && (
                    <button onClick={() => submitAnswer(question.id, shortAnswer)} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">GỬI CÂU TRẢ LỜI</button>
                  )}
                </div>
              )}
            </div>

            {submittedAnswers[question.id] && (
              <div className="text-center p-8 bg-green-50 rounded-[2.5rem] border border-green-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
                <div className="bg-green-500 text-white p-3 rounded-full shadow-lg shadow-green-200">
                  <LucideCheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-green-800 font-black text-lg">Đã ghi nhận câu trả lời!</p>
                <p className="text-green-600 text-sm font-medium italic">Vui lòng chờ slide tiếp theo từ giáo viên.</p>
              </div>
            )}
          </div>
        ) : !isPresentationStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xs space-y-8 py-20 animate-in fade-in zoom-in-95">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse" />
              <div className="bg-indigo-600 text-white p-10 rounded-[2.5rem] shadow-2xl relative">
                <LucideUsers className="w-16 h-16" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Chào mừng {user.name}!</h2>
              <p className="text-slate-500 font-medium mt-3 leading-relaxed">Bạn đã vào phòng chờ. Hãy chờ giáo viên bắt đầu bài giảng nhé.</p>
              <div className="mt-8 flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Đang kết nối...</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xs space-y-8 py-20">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse" />
              <div className="bg-indigo-600 text-white p-10 rounded-[2.5rem] shadow-2xl relative animate-bounce">
                <LucideClock className="w-16 h-16" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Lớp học đang diễn ra</h2>
              <p className="text-slate-500 font-medium mt-3 leading-relaxed">Hãy theo dõi màn hình chính, câu hỏi sẽ tự động xuất hiện khi giáo viên bắt đầu.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentView;
