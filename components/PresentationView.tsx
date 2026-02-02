import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, AnswerResponse, QuestionType } from '../types';
import { socket } from '../services/socketEmulator';
import { LucideChevronLeft, LucideChevronRight, LucideX, LucideChartBar, LucideMessageSquare, LucidePlayCircle, LucideStopCircle, LucideUsers, LucideClock, LucideFlag, LucideTrophy, LucideAward, LucideDownload, LucideRotateCcw, LucideCheckCircle2, LucideTrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PDFSlideRenderer from './PDFSlideRenderer';
import { dataService } from '../services/dataService';

interface StudentScore {
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
}

interface PresentationViewProps {
  session: Session;
  onExit: () => void;
}

const PresentationView: React.FC<PresentationViewProps> = ({ session: initialSession, onExit }) => {
  const [session, setSession] = useState<Session>(initialSession);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSession.currentSlideIndex);
  const [isQuestionActive, setIsQuestionActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [responses, setResponses] = useState<AnswerResponse[]>([]);
  const [scoreMode, setScoreMode] = useState<'CUMULATIVE' | 'SINGLE'>('CUMULATIVE');
  const [manualGrades, setManualGrades] = useState<Record<string, boolean>>({}); // key: questionId_studentName
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [autoShowLeaderboard, setAutoShowLeaderboard] = useState(true);
  const [showFinalReport, setShowFinalReport] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [isPresentationStarted, setIsPresentationStarted] = useState(initialSession.isActive);
  const [joinedStudents, setJoinedStudents] = useState<any[]>([]);
  const timerRef = useRef<number | null>(null);

  const currentSlide = session.slides[currentSlideIndex];
  const activeQuestion = currentSlide?.questions[0];

  // Scoring Logic
  const calculateLeaderboard = (mode: 'CUMULATIVE' | 'SINGLE' = scoreMode): StudentScore[] => {
    const scores: Record<string, StudentScore> = {};
    const relevantResponses = mode === 'SINGLE' && activeQuestion
      ? responses.filter(r => r.questionId === activeQuestion.id)
      : responses;

    relevantResponses.forEach(resp => {
      const q = session.slides.flatMap(s => s.questions).find(q => q.id === resp.questionId);
      if (!q) return;

      if (!scores[resp.studentName]) {
        scores[resp.studentName] = { name: resp.studentName, score: 0, correctAnswers: 0, totalAnswered: 0 };
      }

      scores[resp.studentName].totalAnswered++;

      // Check correctness
      let isCorrect = false;
      if (q.type === QuestionType.SHORT_ANSWER) {
        isCorrect = manualGrades[`${q.id}_${resp.studentName}`] || false;
      } else {
        isCorrect = JSON.stringify(resp.answer) === JSON.stringify(q.correctAnswer);
      }

      if (isCorrect) {
        scores[resp.studentName].correctAnswers++;

        // Base points
        let points = 100;

        // Bonus points for speed (up to 50 based on remaining time)
        if (questionStartTime && q.duration) {
          const responseTime = (resp.timestamp - questionStartTime) / 1000;
          const timeLeftPercent = Math.max(0, (q.duration - responseTime) / q.duration);
          points += Math.round(timeLeftPercent * 50);
        }

        scores[resp.studentName].score += points;
      }
    });

    return Object.values(scores).sort((a, b) => b.score - a.score);
  };

  const handleManualGrade = (studentName: string, questionId: string) => {
    const key = `${questionId}_${studentName}`;
    setManualGrades(prev => {
      const newState = { ...prev, [key]: !prev[key] };
      // Notify student if they got the point
      if (newState[key]) {
        socket.emit('feedback:correct', { studentName });
      }
      return newState;
    });
  };

  const exportToCSV = () => {
    const leaderboard = calculateLeaderboard('CUMULATIVE');
    const headers = ['Hạng', 'Học sinh', 'Số câu đúng', 'Tổng số câu', 'Tổng điểm'];
    const rows = leaderboard.map((s, idx) => [
      idx + 1,
      s.name,
      s.correctAnswers,
      s.totalAnswered,
      s.score
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bao_cao_${session.roomCode}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleQuestion = () => {
    const nextState = !isQuestionActive;
    setIsQuestionActive(nextState);

    if (nextState && activeQuestion) {
      // Bắt đầu đếm ngược
      setTimeLeft(activeQuestion.duration);
      stopTimer();
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopTimer();
            setIsQuestionActive(false);
            socket.emit('question:state', { isActive: false, questionId: null, isTimeout: true });

            if (autoShowLeaderboard) {
              setShowLeaderboard(true);
              socket.emit('leaderboard:show', { leaderboard: calculateLeaderboard() });
            } else {
              setShowStats(true);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      socket.emit('question:state', {
        isActive: true,
        questionId: activeQuestion.id,
        duration: activeQuestion.duration
      });
      setQuestionStartTime(Date.now());
      dataService.updateSession(session.id, { isActive: true, activeQuestionId: activeQuestion.id });
    } else {
      stopTimer();
      setQuestionStartTime(null);
      socket.emit('question:state', { isActive: false, questionId: null });
      dataService.updateSession(session.id, { activeQuestionId: null });
    }
  };

  const changeSlide = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < session.slides.length) {
      setCurrentSlideIndex(newIndex);
      setIsQuestionActive(false);
      stopTimer();
      socket.emit('slide:change', { slideIndex: newIndex });
      socket.emit('question:state', { isActive: false, questionId: null });
      dataService.updateSession(session.id, { currentSlideIndex: newIndex, activeQuestionId: null });
      setShowStats(false);
    }
  }, [session.slides.length, session.id]);

  useEffect(() => {
    socket.joinRoom(session.roomCode);

    socket.emit('session:start', {
      roomCode: session.roomCode,
      currentSlideIndex: currentSlideIndex,
      title: session.title,
      slides: session.slides,
      isStarted: isPresentationStarted
    });

    const handleAnswer = (data: AnswerResponse) => {
      setResponses(prev => [...prev, data]);
    };

    const handlePresenceSync = (presenceState: any) => {
      const students: any[] = [];
      Object.keys(presenceState).forEach(key => {
        presenceState[key].forEach((presence: any) => {
          students.push(presence);
        });
      });
      setJoinedStudents(students);
    };

    socket.on('answer:submit', handleAnswer);
    socket.on('presence:sync', handlePresenceSync);

    return () => {
      socket.off('answer:submit', handleAnswer);
      socket.off('presence:sync', handlePresenceSync);
      socket.leaveRoom();
      stopTimer();
    };
  }, [session, currentSlideIndex, isPresentationStarted]);

  const startPresentation = () => {
    setIsPresentationStarted(true);
    socket.emit('presentation:start', { roomCode: session.roomCode });
    dataService.updateSession(session.id, { isActive: true });
  };

  const statsData = useMemo(() => {
    if (!activeQuestion) return [];
    const currentResponses = responses.filter(r => r.questionId === activeQuestion.id);
    if (activeQuestion.type === QuestionType.MULTIPLE_CHOICE || activeQuestion.type === QuestionType.TRUE_FALSE) {
      return (activeQuestion.options || []).map(opt => ({
        name: opt,
        count: currentResponses.filter(r => r.answer === opt).length,
        isCorrect: opt === activeQuestion.correctAnswer
      }));
    }
    return [];
  }, [activeQuestion, responses]);

  const activeStudents = useMemo(() => {
    const uniqueStudents = new Set<string>();
    responses.forEach(r => uniqueStudents.add(r.studentName));
    return uniqueStudents;
  }, [responses]);

  return (
    <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><LucideX /></button>
          <h2 className="text-white font-bold">{session.title}</h2>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl">
          <LucideUsers className="w-4 h-4 text-indigo-400" />
          <span>{activeStudents.size} Học sinh</span>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setScoreMode('CUMULATIVE')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${scoreMode === 'CUMULATIVE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            CỘNG DỒN
          </button>
          <button
            onClick={() => setScoreMode('SINGLE')}
            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${scoreMode === 'SINGLE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            TỪNG CÂU
          </button>
        </div>
        <div className="bg-indigo-600 px-6 py-2 rounded-xl border border-indigo-400">
          <span className="text-white font-black text-xl tracking-tighter">PHÒNG: {session.roomCode}</span>
        </div>
      </div>

      {/* Main Stage */}
      <div className="flex-1 relative flex items-center justify-center bg-black p-10 overflow-hidden">
        {currentSlide.pdfSource ? (
          <div className="w-full h-full flex items-center justify-center">
            <PDFSlideRenderer url={currentSlide.pdfSource} pageNumber={currentSlide.pdfPage || 1} />
          </div>
        ) : (
          <img key={currentSlide.id} src={currentSlide.imageUrl} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
        )}

        {isQuestionActive && (
          <>
            <div className="absolute top-10 right-10 flex flex-col items-end gap-4 z-20">
              <div className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black shadow-2xl flex items-center gap-4 border-4 border-white/20 animate-pulse">
                <LucideClock className="w-8 h-8" />
                <span className="text-4xl tabular-nums">{timeLeft}s</span>
              </div>
              <div className="bg-amber-500 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                <LucideMessageSquare className="w-4 h-4" /> ĐANG NHẬN CÂU TRẢ LỜI
              </div>
            </div>

            <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-full max-w-4xl px-10 z-20">
              <div className="bg-white/95 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border-4 border-indigo-500 animate-in slide-in-from-bottom-5">
                <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Câu hỏi hiện tại</span>
                <h3 className="text-3xl font-black text-slate-900 leading-tight">{activeQuestion?.prompt}</h3>
              </div>
            </div>
          </>
        )}

        {/* Stats Overlay */}
        {showStats && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-30 p-10 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
            <button onClick={() => setShowStats(false)} className="absolute top-10 right-10 p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-all">
              <LucideX className="w-6 h-6" />
            </button>

            <div className="absolute top-10 left-10 flex items-center gap-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tự động hiện BXH</label>
              <button
                onClick={() => setAutoShowLeaderboard(!autoShowLeaderboard)}
                className={`w-12 h-6 rounded-full transition-all relative ${autoShowLeaderboard ? 'bg-indigo-600' : 'bg-slate-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoShowLeaderboard ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
              <LucideChartBar className="w-8 h-8 text-indigo-600" /> THỐNG KÊ KẾT QUẢ
            </h2>

            <div className="w-full max-w-4xl h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statsData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold' }} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                    {statsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isCorrect ? '#10b981' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {activeQuestion?.type === QuestionType.SHORT_ANSWER && (
              <div className="w-full max-w-3xl mt-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Câu trả lời từ học sinh (Nhấn để cộng điểm)</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {responses.filter(r => r.questionId === activeQuestion.id).map((resp, i) => (
                    <button
                      key={i}
                      onClick={() => handleManualGrade(resp.studentName, activeQuestion.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${manualGrades[`${activeQuestion.id}_${resp.studentName}`] ? 'bg-green-50 border-green-500 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-200'}`}
                    >
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{resp.studentName}</p>
                      <p className="font-bold text-sm">{resp.answer}</p>
                      {manualGrades[`${activeQuestion.id}_${resp.studentName}`] && (
                        <LucideCheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-green-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-3xl">
              <div className="bg-indigo-50 p-6 rounded-3xl text-center">
                <span className="block text-4xl font-black text-indigo-600">{responses.length}</span>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Phản hồi</span>
              </div>
              <div className="bg-green-50 p-6 rounded-3xl text-center">
                <span className="block text-4xl font-black">
                  {responses.filter(r => JSON.stringify(r.answer) === JSON.stringify(activeQuestion?.correctAnswer)).length}
                </span>
                <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Đúng</span>
              </div>
              <button
                onClick={() => setShowLeaderboard(true)}
                className="bg-slate-900 text-white p-6 rounded-3xl text-center hover:scale-105 transition-transform"
              >
                <LucideTrophy className="w-8 h-8 mx-auto mb-1 text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest">Bảng xếp hạng</span>
              </button>
            </div>
            <button
              onClick={() => {
                setShowFinalReport(true);
                socket.emit('session:end', { leaderboard: calculateLeaderboard() });
                dataService.updateSession(session.id, { isActive: false });
              }}
              className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <LucideFlag className="w-5 h-5" /> KẾT THÚC BUỔI HỌC
            </button>
          </div>
        )}

        {/* Leaderboard Overlay */}
        {showLeaderboard && (
          <div className="absolute inset-0 bg-slate-900/98 backdrop-blur-xl z-40 p-10 flex flex-col items-center justify-center animate-in slide-in-from-bottom-10 duration-500">
            <button onClick={() => {
              setShowLeaderboard(false);
              socket.emit('leaderboard:hide', {});
            }} className="absolute top-10 right-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
              <LucideX className="w-6 h-6" />
            </button>

            {/* Simple Fireworks */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-1/4 left-1/4 animate-bounce text-4xl">✨</div>
              <div className="absolute top-1/3 right-1/4 animate-bounce text-4xl delay-100">🎊</div>
              <div className="absolute bottom-1/4 left-1/3 animate-bounce text-4xl delay-300">⭐</div>
            </div>

            <div className="text-center mb-10">
              <LucideTrophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
              <h2 className="text-5xl font-black text-white">BẢNG VINH DANH</h2>
              <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest">Top những học sinh xuất sắc nhất</p>
            </div>

            <div className="w-full max-w-2xl space-y-3">
              {calculateLeaderboard().slice(0, 5).map((student, idx) => (
                <div key={idx} className={`flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/10 ${idx === 0 ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}`}>
                  <div className="flex items-center gap-6">
                    <span className={`text-2xl font-black w-10 h-10 flex items-center justify-center rounded-full ${idx === 0 ? 'bg-yellow-400 text-slate-900' : 'bg-white/10 text-white'}`}>
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xl font-black text-white">{student.name}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase">{student.correctAnswers}/{student.totalAnswered} CÂU ĐÚNG</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-yellow-400">{student.score}</span>
                    <span className="block text-[10px] font-black text-slate-500">POINTS</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                socket.emit('leaderboard:show', { leaderboard: calculateLeaderboard() });
              }}
              className="mt-8 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              CHIA SẺ LÊN TOÀN BỘ MÀN HÌNH HỌC SINH
            </button>
          </div>
        )}

        {/* Final Report Overlay */}
        {showFinalReport && (
          <div className="absolute inset-0 bg-white z-50 p-10 overflow-y-auto flex flex-col items-center">
            <div className="w-full max-w-5xl">
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h1 className="text-4xl font-black text-slate-900">TỔNG KẾT BUỔI HỌC</h1>
                  <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest">{session.title}</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={exportToCSV} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-95 shadow-lg">
                    <LucideDownload className="w-5 h-5" /> XUẤT FILE CSV
                  </button>
                  <button onClick={() => window.location.reload()} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200">
                    <LucideRotateCcw className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-6 mb-12">
                <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100">
                  <LucideUsers className="w-8 h-8 mb-4 opacity-50" />
                  <span className="block text-4xl font-black">{new Set(responses.map(r => r.studentName)).size}</span>
                  <span className="text-xs font-bold uppercase opacity-70 tracking-widest">Học sinh tham gia</span>
                </div>
                <div className="bg-green-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-green-100">
                  <LucideCheckCircle2 className="w-8 h-8 mb-4 opacity-50" />
                  <span className="block text-4xl font-black">
                    {Math.round((responses.filter(resp => {
                      const q = session.slides.flatMap(s => s.questions).find(q => q.id === resp.questionId);
                      return JSON.stringify(resp.answer) === JSON.stringify(q?.correctAnswer);
                    }).length / responses.length) * 100) || 0}%
                  </span>
                  <span className="text-xs font-bold uppercase opacity-70 tracking-widest">Tỉ lệ đúng TB</span>
                </div>
                <div className="bg-yellow-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-yellow-100">
                  <LucideTrendingUp className="w-8 h-8 mb-4 opacity-50" />
                  <span className="block text-4xl font-black">{responses.length}</span>
                  <span className="text-xs font-bold uppercase opacity-70 tracking-widest">Tổng câu trả lời</span>
                </div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-100">
                  <LucideAward className="w-8 h-8 mb-4 opacity-50 text-yellow-400" />
                  <span className="block text-2xl font-black truncate">{calculateLeaderboard()[0]?.name || "N/A"}</span>
                  <span className="text-xs font-bold uppercase opacity-70 tracking-widest">Hạng nhất (MVP)</span>
                </div>
              </div>

              <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                <LucideTrophy className="w-6 h-6 text-yellow-500" /> XẾP HẠNG CHI TIẾT
              </h3>
              <div className="bg-slate-50 rounded-[2.5rem] p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-black text-slate-400 uppercase tracking-widest p-6">
                      <th className="p-6">Hạng</th>
                      <th className="p-6">Học sinh</th>
                      <th className="p-6 text-center">Đúng/Tổng</th>
                      <th className="p-6 text-right">Tổng điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculateLeaderboard('CUMULATIVE').map((student, idx) => (
                      <tr key={idx} className="bg-white/50 hover:bg-white transition-all">
                        <td className="p-6">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black ${idx === 0 ? 'bg-yellow-400 text-slate-900' : 'bg-slate-200 text-slate-600'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-6 font-black text-slate-800">{student.name}</td>
                        <td className="p-6 text-center font-bold text-slate-500">{student.correctAnswers} / {student.totalAnswered}</td>
                        <td className="p-6 text-right text-2xl font-black text-indigo-600">{student.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* Lobby Overlay */}
        {!isPresentationStarted && (
          <div className="absolute inset-0 bg-slate-900 z-[60] flex flex-col items-center justify-center p-10 animate-in fade-in duration-500">
            <div className="text-center mb-12 space-y-4">
              <div className="bg-indigo-600 text-white inline-block px-10 py-6 rounded-[3rem] shadow-2xl border-4 border-indigo-400 mb-6">
                <p className="text-xs font-black uppercase tracking-[0.3em] opacity-70 mb-2">Mã phòng học</p>
                <h2 className="text-8xl font-black tracking-tighter">{session.roomCode}</h2>
              </div>
              <h1 className="text-4xl font-black text-white italic">{session.title}</h1>
              <p className="text-slate-400 font-bold uppercase tracking-widest">Đang chờ học sinh tham gia...</p>
            </div>

            <div className="w-full max-w-4xl bg-white/5 backdrop-blur-md rounded-[3rem] p-10 border border-white/10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-3">
                  <LucideUsers className="text-indigo-400" />
                  DANH SÁCH LỚP ({joinedStudents.length})
                </h3>
                <button
                  onClick={startPresentation}
                  className="bg-indigo-600 hover:bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-xl transition-all shadow-xl active:scale-95 flex items-center gap-3"
                >
                  <LucidePlayCircle /> BẮT ĐẦU BÀI GIẢNG
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 max-h-[40vh] overflow-y-auto pr-4 custom-scrollbar">
                {joinedStudents.map((student, idx) => (
                  <div key={idx} className="bg-white/10 p-4 rounded-2xl text-center border border-white/5 animate-in zoom-in-50">
                    <div className="w-12 h-12 bg-indigo-500 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-black text-xl shadow-lg">
                      {student.name?.[0].toUpperCase()}
                    </div>
                    <p className="text-white font-bold text-xs truncate whitespace-nowrap overflow-hidden w-full">{student.name}</p>
                    <p className="text-indigo-400 font-black text-[8px] uppercase">{student.class}</p>
                  </div>
                ))}
                {joinedStudents.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <div className="inline-block p-6 bg-white/5 rounded-full animate-pulse mb-4">
                      <LucideUsers className="w-10 h-10 text-slate-500" />
                    </div>
                    <p className="text-slate-500 font-medium italic">Chưa có ai vào phòng...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900 border-t border-white/5 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button disabled={currentSlideIndex === 0} onClick={() => changeSlide(currentSlideIndex - 1)} className="p-5 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all"><LucideChevronLeft /></button>
          <div className="flex items-center px-6 h-16 bg-black/40 rounded-2xl text-white font-black text-lg">
            {currentSlideIndex + 1} / {session.slides.length}
          </div>
          <button disabled={currentSlideIndex === session.slides.length - 1} onClick={() => changeSlide(currentSlideIndex + 1)} className="p-5 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all"><LucideChevronRight /></button>
        </div>

        <div className="flex items-center gap-4">
          {activeQuestion && (
            <button
              onClick={toggleQuestion}
              className={`flex items-center gap-3 h-16 px-10 rounded-2xl font-black text-lg transition-all shadow-xl ${isQuestionActive ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`}
            >
              {isQuestionActive ? <LucideStopCircle /> : <LucidePlayCircle />}
              <span>{isQuestionActive ? 'KẾT THÚC SỚM' : 'BẮT ĐẦU CÂU HỎI'}</span>
            </button>
          )}
          <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-3 h-16 bg-white/5 text-white px-10 rounded-2xl font-black text-lg hover:bg-white/10 transition-all"><LucideChartBar /> XEM KẾT QUẢ</button>
        </div>
      </div>
    </div>
  );
};

export default PresentationView;
