import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Session, AnswerResponse, QuestionType } from '../types';
import { socket } from '../services/socketEmulator';
import { LucideChevronLeft, LucideChevronRight, LucideX, LucideChartBar, LucideMessageSquare, LucidePlayCircle, LucideStopCircle, LucideUsers, LucideClock, LucideFlag, LucideTrophy, LucideAward, LucideDownload, LucideRotateCcw, LucideCheckCircle2, LucideTrendingUp, LucideMaximize2, LucideMinimize2, LucideScreenShare, LucideMonitorOff, LucidePencil, LucideEraser, LucideTrash2, LucideStar, LucideMessageCircle, LucideSettings, LucideAlertTriangle, LucideWifiOff, LucideLock, LucideUnlock, LucideDice6, LucideGamepad2, LucideZoomIn, LucideZoomOut, LucideMove } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import RandomPicker from './RandomPicker';
import MillionaireGame from './games/MillionaireGame';
import PDFSlideRenderer from './PDFSlideRenderer';
import { dataService } from '../services/dataService';

interface StudentScore {
  name: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
}

interface Question {
  id: string;
  slideIndex: number;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: any;
  duration: number;
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
  const [scoreMode, setScoreMode] = useState<'CUMULATIVE' | 'SINGLE'>(initialSession.scoreMode || 'CUMULATIVE');
  const [manualGrades, setManualGrades] = useState<Record<string, boolean>>({}); // key: questionId_studentName
  const [showStats, setShowStats] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [autoShowLeaderboard, setAutoShowLeaderboard] = useState(true);
  const [showFinalReport, setShowFinalReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [studentAlerts, setStudentAlerts] = useState<{ name: string, reason: string, id: number }[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [isPresentationStarted, setIsPresentationStarted] = useState(initialSession.isActive);
  const [joinedStudents, setJoinedStudents] = useState<any[]>([]);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [showTeacherHint, setShowTeacherHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showQRHeader, setShowQRHeader] = useState(false);
  const [showSettings, setShowSettingsModal] = useState(false);
  const [basePoints, setBasePoints] = useState(initialSession.basePoints || 100);
  const [isFocusMode, setIsFocusMode] = useState(initialSession.isFocusMode || false);
  const [isSyncingFullscreen, setIsSyncingFullscreen] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [slideZoom, setSlideZoom] = useState(1);
  const [slidePanX, setSlidePanX] = useState(0);
  const [slidePanY, setSlidePanY] = useState(0);
  const [isDraggingSlide, setIsDraggingSlide] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDrawingMode, setIsDrawingMode] = useState(false);

  // Focus Mode Tab Tracking
  const [tabViolations, setTabViolations] = useState<{ name: string, awayAt: number, reported: boolean }[]>([]);

  // Q&A State
  const [qaQuestions, setQaQuestions] = useState<any[]>([]);
  const [showQAPanel, setShowQAPanel] = useState(false);

  // Quick Poll State
  const [quickPoll, setQuickPoll] = useState<any>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Random Picker & Game
  const [showRandomPicker, setShowRandomPicker] = useState(false);
  const [showGame, setShowGame] = useState(false);

  // Real-time Drawing State
  const [paths, setPaths] = useState<any[]>([]);
  const [brushWidth, setBrushWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState('#6366f1');

  const timerRef = useRef<number | null>(null);
  const screenShareTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenCaptureCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentSlide = session.slides[currentSlideIndex];
  const totalQuestions = currentSlide?.questions?.length || 0;
  const activeQuestion = totalQuestions > 0 ? currentSlide?.questions[activeQuestionIndex] : undefined;

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
        const manualGraded = manualGrades[`${q.id}_${resp.studentName}`];
        if (manualGraded) {
          isCorrect = true;
        } else if (q.correctAnswer) {
          // Smart Match: ignore case, trim whitespace, handle string comparisons
          const studentAns = String(resp.answer || '').trim().toLowerCase();
          const correctAns = String(q.correctAnswer).trim().toLowerCase();
          isCorrect = studentAns === correctAns;
        }
      } else {
        isCorrect = JSON.stringify(resp.answer) === JSON.stringify(q.correctAnswer);
      }

      if (isCorrect) {
        scores[resp.studentName].correctAnswers++;

        // Base points
        let points = basePoints;

        // Bonus points for speed (up to 50% of base points based on remaining time)
        if (questionStartTime && q.duration) {
          const responseTime = (resp.timestamp - questionStartTime) / 1000;
          const timeLeftPercent = Math.max(0, (q.duration - responseTime) / q.duration);
          points += Math.round(timeLeftPercent * (basePoints / 2));
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

  // Calculate stats for charts
  const statsData = useMemo(() => {
    if (!activeQuestion) return { pie: [], bar: [] };

    // Filter responses for this question
    const relevantResponses = responses.filter(r => r.questionId === activeQuestion.id);

    // Calculate Correct/Incorrect
    let correctCount = 0;
    relevantResponses.forEach(r => {
      const studentAns = JSON.stringify(r.answer);
      const correctAns = JSON.stringify(activeQuestion.correctAnswer);
      if (studentAns === correctAns) correctCount++;
    });

    const incorrectCount = relevantResponses.length - correctCount;

    const pie = [
      { name: 'Đúng', value: correctCount, color: '#22c55e' },
      { name: 'Sai', value: incorrectCount, color: '#ef4444' }
    ];

    // Calculate Option Distribution
    const bar = (activeQuestion.options || []).map(opt => ({
      name: opt,
      count: relevantResponses.filter(r => r.answer === opt).length
    }));

    return { pie, bar };
  }, [responses, session, currentSlideIndex, activeQuestionIndex]);

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

  // PDF Export via print stylesheet
  const exportToPDF = () => {
    const leaderboard = calculateLeaderboard('CUMULATIVE');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = leaderboard.map((s, idx) =>
      `<tr><td style="padding:8px;border:1px solid #e2e8f0">${idx + 1}</td><td style="padding:8px;border:1px solid #e2e8f0">${s.name}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center">${s.correctAnswers}/${s.totalAnswered}</td><td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:bold">${s.score}</td></tr>`
    ).join('');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Báo cáo - ${session.title}</title>
      <style>body{font-family:system-ui,sans-serif;padding:40px;color:#1e293b}table{width:100%;border-collapse:collapse}th{background:#6366f1;color:#fff;padding:10px;text-align:left}tr:nth-child(even){background:#f8fafc}h1{color:#6366f1}h2{color:#475569;font-weight:normal;margin-top:-8px}.meta{color:#94a3b8;font-size:13px;margin-top:20px}</style>
    </head><body>
      <h1>Báo cáo buổi học</h1>
      <h2>${session.title} &mdash; Mã phòng: ${session.roomCode}</h2>
      <p class="meta">${session.slides.length} slides &bull; ${session.slides.reduce((a, s) => a + s.questions.length, 0)} câu hỏi &bull; ${joinedStudents.length} học sinh &bull; ${new Date().toLocaleString('vi-VN')}</p>
      <table><thead><tr><th>Hạng</th><th>Học sinh</th><th>Câu đúng</th><th>Điểm</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
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
            setShowStats(true); // Open stats, let teacher reveal manually
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      socket.emit('question:state', {
        isActive: true,
        questionId: activeQuestion.id,
        duration: activeQuestion.duration,
        question: {
          id: activeQuestion.id,
          prompt: activeQuestion.prompt,
          type: activeQuestion.type,
          options: activeQuestion.options,
          duration: activeQuestion.duration
        }
      });
      setQuestionStartTime(Date.now());
      dataService.updateSession(session.id, { isActive: true, activeQuestionId: activeQuestion.id });
    } else {
      stopTimer();
      setQuestionStartTime(null);
      socket.emit('question:state', { isActive: false, questionId: null });
      dataService.updateSession(session.id, { activeQuestionId: null });
      setShowStats(true); // Open stats, let teacher reveal manually
    }
  };

  const toggleFocusMode = async () => {
    const newState = !isFocusMode;
    console.log('[PresentationView] toggleFocusMode:', newState);
    setIsFocusMode(newState);
    await dataService.updateSession(session.id, { isFocusMode: newState });
    socket.emit('focus:mode', { enabled: newState, roomCode: session.roomCode });

    // Toast alert for teacher
    const id = Date.now();
    setStudentAlerts(prev => [...prev, {
      id,
      name: 'HỆ THỐNG',
      reason: newState ? 'ĐÃ BẬT CHẾ ĐỘ TẬP TRUNG' : 'ĐÃ TẮT CHẾ ĐỘ TẬP TRUNG'
    }]);
    setTimeout(() => setStudentAlerts(prev => prev.filter(a => a.id !== id)), 3000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 5 }
        } as any,
        audio: false
      });
      setScreenStream(stream);

      // videoRef will be attached to the visible preview <video> element
      // We need a short delay for React to render the preview element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { });
        }
      }, 100);

      // Start broadcasting frames using dedicated screen capture refs
      if (screenShareTimerRef.current) clearInterval(screenShareTimerRef.current);
      screenShareTimerRef.current = window.setInterval(() => {
        if (!videoRef.current || !screenCaptureCanvasRef.current) return;

        const vid = videoRef.current;
        const canvas = screenCaptureCanvasRef.current;
        const ctx = canvas.getContext('2d');

        if (vid.readyState === vid.HAVE_ENOUGH_DATA && ctx) {
          // Use native video resolution (capped at 1920x1080) to avoid blurry upscaling
          const nativeW = vid.videoWidth || 1920;
          const nativeH = vid.videoHeight || 1080;
          const scale = Math.min(1920 / nativeW, 1080 / nativeH, 1);
          canvas.width = Math.round(nativeW * scale);
          canvas.height = Math.round(nativeH * scale);
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);

          // High quality JPEG for readable screen content
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          socket.emit('screen:frame', { image: dataUrl });
        }
      }, 150); // ~7 FPS — smoother viewing

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    if (screenShareTimerRef.current) {
      clearInterval(screenShareTimerRef.current);
      screenShareTimerRef.current = null;
    }
    socket.emit('screen:stop', {});
  };

  const revealAnswer = () => {
    if (!activeQuestion) return;
    setIsAnswerRevealed(true);

    // Calculate current scores to send to students
    const leaderboard = calculateLeaderboard();

    socket.emit('question:reveal', {
      questionId: activeQuestion.id,
      correctAnswer: activeQuestion.correctAnswer,
      leaderboard
    });
    setShowStats(true); // Show per-question stats for teacher
  };

  const changeSlide = useCallback((newIndex: number) => {
    if (newIndex >= 0 && newIndex < session.slides.length) {
      setCurrentSlideIndex(newIndex);
      setActiveQuestionIndex(0);
      setIsQuestionActive(false);
      stopTimer();
      // Clear drawing canvas when changing slides
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      socket.emit('draw:clear', {});
      socket.emit('slide:change', { slideIndex: newIndex });
      socket.emit('question:state', { isActive: false, questionId: null });
      dataService.updateSession(session.id, { currentSlideIndex: newIndex, activeQuestionId: null });
      setShowStats(false);
      setIsAnswerRevealed(false);
    }
  }, [session.slides.length, session.id]);

  useEffect(() => {
    socket.joinRoom(session.roomCode);

    // Emit session info once on mount (not on every slide change)
    socket.emit('session:start', {
      roomCode: session.roomCode,
      currentSlideIndex: 0,
      title: session.title,
      slides: session.slides,
      isStarted: false
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

    const handleQASubmit = (data: any) => {
      const { question } = data;
      setQaQuestions(prev => {
        const updated = [...prev, question];
        socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
        return updated;
      });
    };

    const handleQAUpvote = (data: any) => {
      const { questionId, studentName } = data;
      setQaQuestions(prev => {
        const updated = prev.map(q => {
          if (q.id === questionId) {
            const upvotes = q.upvotes.includes(studentName)
              ? q.upvotes.filter((n: string) => n !== studentName)
              : [...q.upvotes, studentName];
            return { ...q, upvotes };
          }
          return q;
        });
        socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
        return updated;
      });
    };

    const handlePollResponse = (data: any) => {
      const { studentName, option } = data;
      setQuickPoll((prev: any) => {
        if (!prev) return null;
        const updated = { ...prev, responses: { ...prev.responses, [studentName]: option } };
        return updated;
      });
    };

    socket.on('answer:submit', handleAnswer);
    socket.on('presence:sync', handlePresenceSync);
    socket.on('qa:submit', handleQASubmit);
    socket.on('qa:upvote', handleQAUpvote);
    const handleStudentAlert = (data: { name: string, reason: string }) => {
      const id = Date.now();
      setStudentAlerts(prev => [...prev, { ...data, id }]);
      setTimeout(() => {
        setStudentAlerts(prev => prev.filter(a => a.id !== id));
      }, 5000);
    };

    const handleStudentTabAway = (data: { name: string, timestamp: number }) => {
      console.log('[PresentationView] student:tab-away received', data);
      setTabViolations(prev => {
        if (prev.find(v => v.name === data.name)) return prev;
        return [...prev, { name: data.name, awayAt: Date.now(), reported: false }];
      });
      // Show alert immediately
      const id = Date.now() + Math.random();
      setStudentAlerts(prev => [...prev, { id, name: data.name, reason: 'ĐANG RỜI TAB...' }]);
      setTimeout(() => setStudentAlerts(prev => prev.filter(a => a.id !== id)), 5000);
    };

    const handleStudentTabBack = (data: { name: string, timestamp: number }) => {
      setTabViolations(prev => prev.filter(v => v.name !== data.name));
    };

    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      dataService.syncOfflineData();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    socket.on('student:alert', handleStudentAlert);
    socket.on('poll:response', handlePollResponse);
    socket.on('student:tab-away', handleStudentTabAway);
    socket.on('student:tab-back', handleStudentTabBack);

    // Fetch historical data
    const fetchHistory = async () => {
      const respHistory = await dataService.getResponses(session.id);
      if (respHistory.length > 0) setResponses(respHistory);

      const qaHistory = await dataService.getQAQuestions(session.id);
      if (qaHistory.length > 0) {
        setQaQuestions(qaHistory.map(q => ({
          id: q.id,
          studentName: q.student_name,
          content: q.content,
          timestamp: q.timestamp,
          upvotes: q.upvotes || [],
          isAnswered: q.is_answered,
          isFeatured: q.is_featured
        })));
      }

      const pollHistory = await dataService.getPolls(session.id);
      const activePoll = pollHistory.find(p => p.is_active);
      if (activePoll) {
        setQuickPoll({
          id: activePoll.id,
          prompt: activePoll.prompt,
          options: activePoll.options,
          responses: activePoll.responses || {}
        });
      }

      if (session.isFocusMode !== undefined) setIsFocusMode(session.isFocusMode);
    };
    fetchHistory();

    return () => {
      socket.off('answer:submit', handleAnswer);
      socket.off('presence:sync', handlePresenceSync);
      socket.off('qa:submit', handleQASubmit);
      socket.off('qa:upvote', handleQAUpvote);
      socket.off('poll:response', handlePollResponse);
      socket.off('student:alert', handleStudentAlert);
      socket.off('student:tab-away', handleStudentTabAway);
      socket.off('student:tab-back', handleStudentTabBack);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      socket.leaveRoom();
      stopTimer();
      stopScreenShare();
    };
  }, [session.id, session.roomCode]);

  // Auto-report tab violations after 10 seconds
  useEffect(() => {
    if (!isFocusMode || tabViolations.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTabViolations(prev => prev.map(v => {
        if (!v.reported && (now - v.awayAt) >= 10000) {
          const id = now + Math.random();
          setStudentAlerts(alerts => [...alerts, {
            id,
            name: v.name,
            reason: 'RỜI TAB QUÁ 10 GIÂY - VI PHẠM!'
          }]);
          setTimeout(() => setStudentAlerts(alerts => alerts.filter(a => a.id !== id)), 8000);
          return { ...v, reported: true };
        }
        return v;
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isFocusMode, tabViolations.length]);

  // Tick every second to update "Rời tab Xs" counter in realtime
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    if (!isFocusMode || tabViolations.length === 0) return;
    const t = setInterval(() => setFocusTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [isFocusMode, tabViolations.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          changeSlide(currentSlideIndex - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          changeSlide(currentSlideIndex + 1);
          break;
        case ' ':
          e.preventDefault();
          if (activeQuestion) toggleQuestion();
          break;
        case 'l':
        case 'L':
          setShowLeaderboard(prev => !prev);
          break;
        case 'Escape':
          if (isFullscreen) toggleFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, changeSlide, activeQuestion, isFullscreen]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const domX = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const domY = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    const x = domX * scaleX;
    const y = domY * scaleY;

    const newPath = {
      points: [{ x, y }],
      color: isEraser ? '#00000000' : brushColor,
      width: brushWidth,
      isEraser
    };

    setPaths(prev => [...prev, newPath]);
    socket.emit('draw:start', { path: newPath, roomCode: session.roomCode });
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const domX = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const domY = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    const x = domX * scaleX;
    const y = domY * scaleY;

    setPaths(prev => {
      const lastPath = prev[prev.length - 1];
      if (!lastPath) return prev;
      const updatedPath = { ...lastPath, points: [...lastPath.points, { x, y }] };
      return [...prev.slice(0, -1), updatedPath];
    });

    socket.emit('draw:move', { point: { x, y }, roomCode: session.roomCode });

    // Physical drawing on teacher canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const lastPath = paths[paths.length - 1];
      if (lastPath && lastPath.points.length > 0) {
        const lastPoint = lastPath.points[lastPath.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = isEraser ? 'black' : brushColor;
        ctx.lineWidth = brushWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      socket.emit('draw:end', { roomCode: session.roomCode });
    }
  };

  const clearCanvas = () => {
    setPaths([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    socket.emit('draw:clear', { roomCode: session.roomCode });
  };

  useEffect(() => {
    // Clear paths on slide change
    clearCanvas();
  }, [currentSlideIndex]);

  const startPresentation = () => {
    setIsPresentationStarted(true);
    socket.emit('presentation:start', { roomCode: session.roomCode });
    dataService.updateSession(session.id, { isActive: true });
  };


  const activeStudents = useMemo(() => {
    const uniqueStudents = new Set<string>();
    responses.forEach(r => uniqueStudents.add(r.studentName));
    return uniqueStudents;
  }, [responses]);

  return (
    <>
      <div className="fixed inset-0 bg-slate-950 z-[100] flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={onExit} className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><LucideX /></button>
            <h2 className="text-white font-bold">{session.title}</h2>
          </div>
          <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl">
            <LucideUsers className="w-4 h-4 text-indigo-400" />
            <span>{joinedStudents.length} Học sinh</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-[10px] font-black uppercase transition-all border border-white/10"
              title="Toàn màn hình"
            >
              {isFullscreen ? <LucideMinimize2 className="w-4 h-4" /> : <LucideMaximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">PHÓNG TO</span>
            </button>

            <button
              onClick={screenStream ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${screenStream ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
              title="Chia sẻ màn hình"
            >
              {screenStream ? <LucideMonitorOff className="w-4 h-4" /> : <LucideScreenShare className="w-4 h-4" />}
              <span className="hidden sm:inline">{screenStream ? 'DỪNG CHIA SẺ' : 'CHIA SẺ MH'}</span>
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 text-[10px] font-black uppercase transition-all border border-white/10"
              title="Cài đặt tính điểm"
            >
              <LucideSettings className="w-4 h-4" />
              <span className="hidden sm:inline">CÀI ĐẶT</span>
            </button>
          </div>
          <div className="bg-indigo-600 px-6 py-2 rounded-xl border border-indigo-400 flex items-center gap-4 relative">
            <span className="text-white font-black text-xl tracking-tighter">PHÒNG: {session.roomCode}</span>
            <button
              onClick={() => setShowQRHeader(!showQRHeader)}
              className="p-1 bg-white/20 hover:bg-white/40 rounded-lg transition-all"
              title="Hiện mã QR để học sinh vào phòng"
            >
              <LucideMaximize2 className="w-4 h-4 text-white" />
            </button>

            {showQRHeader && (
              <div className="absolute top-full mt-4 right-0 p-4 bg-white rounded-3xl shadow-2xl border-4 border-indigo-600 z-[100] animate-in zoom-in-95">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/?room=${session.roomCode}`)}`}
                  alt="QR Code"
                  className="w-40 h-40 rounded-xl"
                />
                <p className="text-[10px] font-black text-indigo-600 text-center mt-2 uppercase tracking-widest">Quét để vào phòng</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Stage */}
        <div className={`flex-1 relative flex items-center justify-center bg-black overflow-hidden ${screenStream ? 'p-2' : 'p-10'}`}>
          {/* Drawing Toggle + Controls (Floating) */}
          {isPresentationStarted && (
            <div className="absolute top-1/2 -translate-y-1/2 left-6 z-40 flex flex-col gap-3">
              {/* Toggle Drawing Mode Button */}
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                className={`p-4 rounded-2xl transition-all shadow-2xl border ${isDrawingMode ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/30' : 'bg-slate-900/90 backdrop-blur-xl text-slate-400 hover:text-white border-white/10'}`}
                title={isDrawingMode ? 'Tắt vẽ (dùng chuột cuộn zoom, kéo di chuyển)' : 'Bật vẽ'}
              >
                <LucidePencil className="w-5 h-5" />
              </button>

              {/* Drawing Tools - only show when drawing mode is ON */}
              {isDrawingMode && (
                <div className="flex flex-col gap-3 bg-slate-900/90 backdrop-blur-xl p-3 rounded-[2rem] border border-white/10 shadow-2xl animate-in slide-in-from-left-3 duration-200">
                  <button
                    onClick={() => setIsEraser(false)}
                    className={`p-4 rounded-2xl transition-all ${!isEraser ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <LucidePencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIsEraser(true)}
                    className={`p-4 rounded-2xl transition-all ${isEraser ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <LucideEraser className="w-5 h-5" />
                  </button>
                  <div className="w-full h-px bg-white/10 my-1" />
                  {['#ef4444', '#10b981', '#6366f1', '#f59e0b', '#ffffff'].map(color => (
                    <button
                      key={color}
                      onClick={() => { setBrushColor(color); setIsEraser(false); }}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${brushColor === color && !isEraser ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="w-full h-px bg-white/10 my-1" />
                  <div className="flex flex-col gap-2 items-center">
                    {[2, 4, 8].map(size => (
                      <button
                        key={size}
                        onClick={() => setBrushWidth(size)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${brushWidth === size ? 'bg-white text-slate-900 border-white font-black text-xs' : 'text-slate-400 border-white/10 hover:border-white/30 text-[10px]'}`}
                      >
                        {size === 2 ? 'S' : size === 4 ? 'M' : 'L'}
                      </button>
                    ))}
                  </div>
                  <div className="w-full h-px bg-white/10 my-1" />
                  <button
                    onClick={clearCanvas}
                    className="p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                    title="Xoá tất cả vẽ"
                  >
                    <LucideTrash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Q&A Side Panel (Teacher View) */}
          {showQAPanel && (
            <div className="absolute top-40 right-10 w-80 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] border border-white/10 flex flex-col shadow-2xl z-50 animate-in slide-in-from-right-5 overflow-hidden">
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <LucideMessageCircle className="w-4 h-4 text-indigo-400" /> CÂU HỎI Q&A ({qaQuestions.length})
                </h3>
                <button onClick={() => setShowQAPanel(false)} className="p-2 hover:bg-white/10 rounded-full text-slate-400 border border-white/5">
                  <LucideX className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {qaQuestions.length === 0 ? (
                  <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
                    <LucideMessageSquare className="w-10 h-10" />
                    <p className="text-xs font-bold text-white uppercase tracking-widest">Chưa có câu hỏi</p>
                  </div>
                ) : (
                  qaQuestions.sort((a, b) => b.upvotes.length - a.upvotes.length).map((q) => (
                    <div key={q.id} className={`p-4 rounded-2xl border transition-all ${q.isFeatured ? 'bg-indigo-600/30 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{q.studentName}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              const updated = qaQuestions.map(item => item.id === q.id ? { ...item, isFeatured: !item.isFeatured } : item);
                              setQaQuestions(updated);
                              socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
                            }}
                            className={`p-1.5 rounded-lg transition-all ${q.isFeatured ? 'bg-amber-500 text-white' : 'hover:bg-white/10 text-slate-500'}`}
                            title="Nổi bật câu hỏi"
                          >
                            <LucideStar className={`w-3 h-4 ${q.isFeatured ? 'fill-current' : ''}`} />
                          </button>
                          <button
                            onClick={() => {
                              const updated = qaQuestions.filter(item => item.id !== q.id);
                              setQaQuestions(updated);
                              socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all font-black p-2"
                          >
                            <LucideX className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-slate-200 leading-snug">{q.content}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
                          <LucideTrendingUp className="w-3 h-3" />
                          <span className="text-[10px] font-black">{q.upvotes.length}</span>
                        </div>
                        <button
                          onClick={() => {
                            const updated = qaQuestions.map(item => item.id === q.id ? { ...item, isAnswered: !item.isAnswered } : item);
                            setQaQuestions(updated);
                            socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
                          }}
                          className={`text-[9px] font-black px-3 py-1.5 rounded-full transition-all border-2 ${q.isAnswered ? 'bg-green-500 border-green-500 text-white' : 'border-white/10 text-slate-400 hover:border-white/20'}`}
                        >
                          {q.isAnswered ? 'ĐÃ TRẢ LỜI' : 'CHƯA TRẢ LỜI'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/10">
                <p className="text-[9px] font-black text-slate-500 text-center uppercase tracking-widest">Câu hỏi nổi bật sẽ hiển thị với lớp</p>
              </div>
            </div>
          )}

          {/* Featured Question Overlay on Stage */}
          {qaQuestions.find(q => q.isFeatured) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[60] animate-in slide-in-from-bottom-10 duration-700">
              <div className="bg-indigo-600 p-8 rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(79,70,229,0.5)] border-4 border-white/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32 animate-pulse" />
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-amber-400 p-3 rounded-2xl shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                    <LucideMessageCircle className="w-6 h-6 text-indigo-900" />
                  </div>
                  <div>
                    <span className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase block mb-1">CÂU HỎI ĐANG THẢO LUẬN</span>
                    <span className="text-white font-black text-sm">{qaQuestions.find(q => q.isFeatured)?.studentName} hỏi:</span>
                  </div>
                </div>
                <h2 className="text-2xl font-black text-white leading-tight mb-4 drop-shadow-md">"{qaQuestions.find(q => q.isFeatured)?.content}"</h2>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center text-white/80 font-bold text-xs">
                    <LucideTrendingUp className="w-4 h-4 text-amber-300" />
                    <span>{qaQuestions.find(q => q.isFeatured)?.upvotes.length} lượt quan tâm</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = qaQuestions.map(q => ({ ...q, isFeatured: false }));
                      setQaQuestions(updated);
                      socket.emit('qa:update', { questions: updated, roomCode: session.roomCode });
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    ĐÓNG THẢO LUẬN
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Poll Creator / Results Overlay */}
          {showPollCreator && (
            <div className="absolute inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative overflow-hidden text-slate-900 font-sans">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16" />
                <button onClick={() => setShowPollCreator(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 border border-slate-100 transition-all"><LucideX /></button>
                <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                  <LucideChartBar className="text-indigo-600" /> BÌNH CHỌN NHANH
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Lựa chọn phản hồi</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Đúng / Sai', options: ['Đúng', 'Sai'] },
                        { label: 'A / B / C / D', options: ['A', 'B', 'C', 'D'] },
                        { label: 'Đồng ý / Không', options: ['Đồng ý', 'Không đồng ý'] },
                        { label: '1 - 5 Sao', options: ['1', '2', '3', '4', '5'] }
                      ].map((preset, idx) => (
                        <button
                          key={idx}
                          onClick={async () => {
                            const saved = await dataService.createPoll(session.id, 'Phản hồi ngay!', preset.options);
                            if (saved) {
                              const poll = {
                                id: saved.id,
                                prompt: 'Phản hồi ngay!',
                                options: preset.options,
                                responses: {},
                                isActive: true
                              };
                              setQuickPoll(poll);
                              socket.emit('poll:start', { poll, roomCode: session.roomCode });
                              setShowPollCreator(false);
                            }
                          }}
                          className="p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 text-sm font-black text-slate-600 transition-all text-center active:scale-95 touch-manipulation"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Quick Poll Results on Stage */}
          {quickPoll && (
            <div className="absolute inset-0 z-[65] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-10 animate-in zoom-in-95 duration-500">
              <div className="w-full max-w-4xl flex flex-col items-center">
                <div className="text-center mb-10">
                  <span className="bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-4 inline-block shadow-lg">BÌNH CHỌN NHANH ĐANG DIỄN RA</span>
                  <h2 className="text-4xl font-black text-white">Hãy chọn phương án của bạn!</h2>
                </div>

                <div className="w-full grid grid-cols-2 gap-6 mb-12">
                  {quickPoll.options.map((opt: string) => {
                    const count = Object.values(quickPoll.responses).filter(v => v === opt).length;
                    const total = Object.keys(quickPoll.responses).length || 1;
                    const percent = Math.round((count / total) * 100);

                    return (
                      <div key={opt} className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-white/20 transition-all">
                        <div className="absolute bottom-0 left-0 h-2 bg-indigo-500 transition-all duration-1000" style={{ width: `${percent}%` }} />
                        <div className="flex justify-between items-center mb-4 relative z-10">
                          <span className="text-2xl font-black text-white">{opt}</span>
                          <span className="text-4xl font-black text-indigo-400">{percent}%</span>
                        </div>
                        <p className="text-slate-400 font-bold text-sm relative z-10 uppercase tracking-widest">{count} Phản hồi</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      if (quickPoll) {
                        await dataService.updatePollActive(quickPoll.id, false);
                        setQuickPoll(null);
                        socket.emit('poll:stop', { roomCode: session.roomCode });
                      }
                    }}
                    className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl hover:bg-red-700 transition-all active:scale-95 touch-manipulation"
                  >
                    KẾT THÚC BÌNH CHỌN
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            className={`relative w-full h-full flex items-center justify-center overflow-hidden ${!isDrawingMode && slideZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? -0.15 : 0.15;
              setSlideZoom(z => {
                const newZ = Math.min(Math.max(z + delta, 0.5), 4);
                if (newZ <= 1) { setSlidePanX(0); setSlidePanY(0); }
                return newZ;
              });
            }}
            onMouseDown={(e) => {
              if (isDrawingMode || slideZoom <= 1) return;
              e.preventDefault();
              setIsDraggingSlide(true);
              setDragStart({ x: e.clientX - slidePanX, y: e.clientY - slidePanY });
            }}
            onMouseMove={(e) => {
              if (!isDraggingSlide) return;
              setSlidePanX(e.clientX - dragStart.x);
              setSlidePanY(e.clientY - dragStart.y);
            }}
            onMouseUp={() => setIsDraggingSlide(false)}
            onMouseLeave={() => setIsDraggingSlide(false)}
          >
            <div
              className="relative w-full h-full flex items-center justify-center"
              style={{
                transform: `scale(${slideZoom}) translate(${slidePanX / slideZoom}px, ${slidePanY / slideZoom}px)`,
                transition: isDraggingSlide ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              {screenStream ? (
                <div className="w-full h-full relative group">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse z-20">
                    <div className="w-2 h-2 bg-white rounded-full" /> ĐANG CHIA SẺ MÀN HÌNH
                  </div>
                </div>
              ) : currentSlide.pdfSource ? (
                <div className="w-full h-full flex items-center justify-center">
                  <PDFSlideRenderer url={currentSlide.pdfSource} pageNumber={currentSlide.pdfPage || 1} />
                </div>
              ) : (
                <img key={currentSlide.id} src={currentSlide.imageUrl} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
              )}

              {/* Drawing Canvas Overlay — only intercepts mouse when drawing mode is ON */}
              {isPresentationStarted && (
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full z-10 touch-none ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
                  width={1920}
                  height={1080}
                  onMouseDown={isDrawingMode ? startDrawing : undefined}
                  onMouseMove={isDrawingMode ? draw : undefined}
                  onMouseUp={isDrawingMode ? stopDrawing : undefined}
                  onMouseLeave={isDrawingMode ? stopDrawing : undefined}
                  onTouchStart={isDrawingMode ? startDrawing : undefined}
                  onTouchMove={isDrawingMode ? draw : undefined}
                  onTouchEnd={isDrawingMode ? stopDrawing : undefined}
                />
              )}
            </div>

            {/* Zoom indicator — shows when zoomed */}
            {slideZoom !== 1 && (
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1">
                <button
                  onClick={() => { setSlideZoom(1); setSlidePanX(0); setSlidePanY(0); }}
                  className="px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1.5"
                  title="Reset zoom"
                >
                  <LucideZoomOut className="w-3.5 h-3.5" />
                  {Math.round(slideZoom * 100)}% — click to reset
                </button>
              </div>
            )}
          </div>

          {/* Focus Mode Student Tracking Panel */}
          {isFocusMode && isPresentationStarted && (
            <div className="absolute top-4 right-4 w-64 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl z-30 animate-in slide-in-from-right-5 duration-300 max-h-[70vh] flex flex-col">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">CHẾ ĐỘ TẬP TRUNG</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-2 py-1.5 text-center">
                    <span className="text-lg font-black text-green-400">{joinedStudents.filter(s => !tabViolations.find(v => v.name === s.name)).length}</span>
                    <p className="text-[8px] font-black text-green-500 uppercase">Trong tab</p>
                  </div>
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-2 py-1.5 text-center">
                    <span className="text-lg font-black text-red-400">{tabViolations.length}</span>
                    <p className="text-[8px] font-black text-red-500 uppercase">Ngoài tab</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
                {/* Sort: away students first (most recent first), then in-tab students */}
                {[...joinedStudents]
                  .sort((a, b) => {
                    const aAway = tabViolations.find(v => v.name === a.name);
                    const bAway = tabViolations.find(v => v.name === b.name);
                    if (aAway && !bAway) return -1;
                    if (!aAway && bAway) return 1;
                    if (aAway && bAway) return bAway.awayAt - aAway.awayAt;
                    return 0;
                  })
                  .map((student, idx) => {
                    const violation = tabViolations.find(v => v.name === student.name);
                    const isAway = !!violation;
                    const awaySeconds = violation ? Math.floor((Date.now() - violation.awayAt) / 1000) : 0;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all ${isAway
                          ? 'bg-red-600/30 border-2 border-red-500/60 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                          : 'bg-green-500/10 border border-green-500/20'
                          }`}
                      >
                        <div className={`w-3 h-3 rounded-full shrink-0 ${isAway ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isAway ? 'text-red-200' : 'text-green-300'}`}>
                            {student.name}
                          </p>
                          {isAway && (
                            <p className="text-[9px] font-black text-red-400 flex items-center gap-1">
                              ⚠️ Rời tab {awaySeconds}s{violation.reported ? ' — VI PHẠM!' : ''}
                            </p>
                          )}
                        </div>
                        {isAway && (
                          <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md shrink-0 animate-pulse uppercase">
                            Out
                          </span>
                        )}
                      </div>
                    );
                  })}
                {joinedStudents.length === 0 && (
                  <p className="text-[10px] text-slate-500 text-center py-4 italic">Chưa có học sinh</p>
                )}
              </div>
            </div>
          )}

          {/* Real-time Response Tracker (Sidebar) */}
          {(isQuestionActive || showStats) && (
            <div className="absolute top-40 right-10 w-72 bg-slate-900/90 backdrop-blur-md rounded-[2rem] border border-white/10 p-6 shadow-2xl animate-in slide-in-from-right-5 duration-500 z-30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái ( {responses.filter(r => r.questionId === activeQuestion?.id).length} / {joinedStudents.length} )</h4>
              </div>
              {activeQuestion?.prompt && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-4">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Câu hỏi hiện tại</p>
                  <p className="text-xs font-bold text-white line-clamp-2">{activeQuestion.prompt}</p>
                </div>
              )}
              {/* Correct/Incorrect summary after reveal */}
              {isAnswerRevealed && activeQuestion && (() => {
                const answeredResponses = responses.filter(r => r.questionId === activeQuestion.id);
                let correctCount = 0;
                let incorrectCount = 0;
                answeredResponses.forEach(resp => {
                  let isCorrect = false;
                  if (activeQuestion.type === QuestionType.SHORT_ANSWER) {
                    const manualGraded = manualGrades[`${activeQuestion.id}_${resp.studentName}`];
                    if (manualGraded) isCorrect = true;
                    else if (activeQuestion.correctAnswer) {
                      isCorrect = String(resp.answer || '').trim().toLowerCase() === String(activeQuestion.correctAnswer).trim().toLowerCase();
                    }
                  } else {
                    isCorrect = JSON.stringify(resp.answer) === JSON.stringify(activeQuestion.correctAnswer);
                  }
                  if (isCorrect) correctCount++; else incorrectCount++;
                });
                return (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-green-500/20 border border-green-500/30 rounded-xl p-3 text-center">
                      <span className="block text-xl font-black text-green-400">{correctCount}</span>
                      <span className="text-[9px] font-black text-green-500 uppercase">Đúng</span>
                    </div>
                    <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
                      <span className="block text-xl font-black text-red-400">{incorrectCount}</span>
                      <span className="text-[9px] font-black text-red-500 uppercase">Sai</span>
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {joinedStudents.map((student, idx) => {
                  const response = responses.find(r => r.questionId === activeQuestion?.id && r.studentName === student.name);
                  const hasAnswered = !!response;

                  let containerStyle = hasAnswered
                    ? 'bg-indigo-500/10 border-indigo-500/30'
                    : 'bg-white/5 border-white/5 opacity-40';
                  let nameStyle = hasAnswered ? 'text-white' : 'text-slate-500';
                  let statusLabel = '';

                  if (isAnswerRevealed && hasAnswered && activeQuestion) {
                    let isCorrect = false;
                    if (activeQuestion.type === QuestionType.SHORT_ANSWER) {
                      const manualGraded = manualGrades[`${activeQuestion.id}_${student.name}`];
                      if (manualGraded) isCorrect = true;
                      else if (activeQuestion.correctAnswer) {
                        isCorrect = String(response.answer || '').trim().toLowerCase() === String(activeQuestion.correctAnswer).trim().toLowerCase();
                      }
                    } else {
                      isCorrect = JSON.stringify(response.answer) === JSON.stringify(activeQuestion.correctAnswer);
                    }

                    // Color coding for results
                    containerStyle = isCorrect
                      ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                      : 'bg-red-500/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]';
                    nameStyle = isCorrect ? 'text-green-400' : 'text-red-400';
                    statusLabel = isCorrect ? '✓ ĐÚNG' : '✗ SAI';
                  }

                  return (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-500 ${containerStyle}`}>
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${hasAnswered ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-600'}`} />
                        <span className={`text-[11px] font-bold truncate ${nameStyle}`}>{student.name}</span>
                      </div>
                      {hasAnswered && (
                        isAnswerRevealed ? (
                          <span className={`text-[9px] font-black shrink-0 ${nameStyle}`}>{statusLabel}</span>
                        ) : <LucideCheckCircle2 className="w-3 h-3 text-indigo-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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

              <div className="absolute bottom-40 left-1/2 -translate-x-1/2 w-full max-w-2xl z-20 px-4">
                <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border-4 border-white/10 animate-in slide-in-from-bottom-5 w-full">
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Câu hỏi hiện tại</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowTeacherHint(!showTeacherHint)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${showTeacherHint ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                      >
                        {showTeacherHint ? 'ẨN ĐÁP ÁN GV' : 'XEM ĐÁP ÁN GV'}
                      </button>
                      {activeQuestion?.type !== QuestionType.SHORT_ANSWER && (
                        <div className="flex gap-1 ml-2">
                          {activeQuestion?.options?.map((_, i) => (
                            <span key={i} className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[9px] font-black text-white">{String.fromCharCode(65 + i)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-white leading-tight mb-6">{activeQuestion?.prompt}</h3>

                  {/* Options Preview for Teacher */}
                  {activeQuestion?.type !== QuestionType.SHORT_ANSWER && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {activeQuestion?.options?.map((opt, i) => {
                        const isCorrect = activeQuestion.correctAnswer === opt;
                        const showAsCorrect = isCorrect && (showTeacherHint || isAnswerRevealed);
                        return (
                          <div key={i} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all duration-300 ${showAsCorrect ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-white/5 border-white/10 text-slate-300'}`}>
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center text-[10px] font-black">{String.fromCharCode(65 + i)}</span>
                              <span className="text-sm font-bold">{opt}</span>
                            </div>
                            {showAsCorrect && <LucideCheckCircle2 className="w-4 h-4 animate-in zoom-in" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeQuestion?.type === QuestionType.SHORT_ANSWER && activeQuestion.correctAnswer && (showTeacherHint || isAnswerRevealed) && (
                    <div className="mt-4 p-4 bg-green-500/10 border-2 border-green-500/30 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                      <LucideCheckCircle2 className="w-5 h-5 text-green-400" />
                      <div>
                        <span className="text-[10px] font-black text-green-400 uppercase tracking-widest block">Đáp án đúng (Hệ thống tự rà soát)</span>
                        <span className="text-white font-bold">{activeQuestion.correctAnswer}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}



          {/* Stats Modal */}
          {showStats && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] p-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl p-8 w-full max-w-4xl shadow-2xl relative">
                <button onClick={() => setShowStats(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400"><LucideX /></button>
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><LucideChartBar className="text-indigo-600" /> THỐNG KÊ CÂU HỎI</h2>

                <div className="grid grid-cols-2 gap-8 h-[400px]">
                  {/* Pie Chart */}
                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <h3 className="font-bold text-slate-500 mb-4 uppercase text-xs tracking-widest">Tỷ lệ Đúng / Sai</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={statsData.pie} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {statsData.pie.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 text-sm font-bold">
                      <span className="text-green-600">Đúng: {statsData.pie[0]?.value}</span>
                      <span className="text-red-500">Sai: {statsData.pie[1]?.value}</span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-col items-center justify-center">
                    <h3 className="font-bold text-slate-500 mb-4 uppercase text-xs tracking-widest">Phân bố đáp án</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={statsData.bar}>
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Overlay */}
          {showLeaderboard && (
            <div className="absolute inset-0 bg-slate-950 z-40 p-10 flex flex-col items-center justify-center animate-in slide-in-from-bottom-10 duration-500">
              <button onClick={() => {
                setShowLeaderboard(false);
                socket.emit('leaderboard:hide', {});
              }} className="absolute top-10 right-10 p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
                <LucideX className="w-6 h-6" />
              </button>

              {/* Simple Fireworks */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 left-1/4 animate-bounce text-4xl opacity-50">✨</div>
                <div className="absolute top-1/3 right-1/4 animate-ping text-5xl opacity-50">🎉</div>
                <div className="absolute bottom-1/4 left-1/3 animate-bounce text-4xl opacity-50">✨</div>
                <div className="absolute top-2/3 right-1/3 animate-pulse text-6xl opacity-30">⭐</div>
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
              <div className="flex flex-col md:flex-row items-center gap-10 mb-12">
                <div className="text-center md:text-left space-y-4">
                  <div className="bg-indigo-600 text-white inline-block px-10 py-6 rounded-[3rem] shadow-2xl border-4 border-indigo-400 mb-6">
                    <p className="text-xs font-black uppercase tracking-[0.3em] opacity-70 mb-2">Mã phòng học</p>
                    <h2 className="text-8xl font-black tracking-tighter">{session.roomCode}</h2>
                  </div>
                  <h1 className="text-4xl font-black text-white italic">{session.title}</h1>
                  <p className="text-slate-400 font-bold uppercase tracking-widest">Đang chờ học sinh tham gia...</p>
                </div>

                <div className="bg-white p-6 rounded-[3rem] shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/?room=${session.roomCode}`)}`}
                    alt="Lobby QR"
                    className="w-48 h-48 rounded-2xl"
                  />
                  <p className="text-[10px] font-black text-indigo-600 text-center mt-3 uppercase tracking-widest">Quét để vào ngay 🚀</p>
                </div>
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

          {/* Settings Modal */}
          {showSettings && (
            <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative overflow-hidden text-slate-900 font-sans">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16" />
                <button onClick={() => setShowSettingsModal(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 border border-slate-100 transition-all"><LucideX /></button>

                <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                  <LucideSettings className="text-indigo-600" /> CÀI ĐẶT BUỔI HỌC
                </h3>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Chế độ tính điểm</label>
                    <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                      <button
                        onClick={() => {
                          setScoreMode('CUMULATIVE');
                          dataService.updateSession(session.id, { scoreMode: 'CUMULATIVE' });
                        }}
                        className={`py-4 rounded-xl text-xs font-black transition-all ${scoreMode === 'CUMULATIVE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        CỘNG DỒN
                      </button>
                      <button
                        onClick={() => {
                          setScoreMode('SINGLE');
                          dataService.updateSession(session.id, { scoreMode: 'SINGLE' });
                        }}
                        className={`py-4 rounded-xl text-xs font-black transition-all ${scoreMode === 'SINGLE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        TỪNG CÂU
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic">
                      * {scoreMode === 'CUMULATIVE' ? 'Điểm của học sinh sẽ được cộng dồn qua tất cả các slide.' : 'Chỉ tính điểm cho câu hỏi đang mở trên slide hiện tại.'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Điểm cơ bản (Mỗi câu đúng)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="10"
                        max="1000"
                        step="10"
                        value={basePoints}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBasePoints(val);
                          dataService.updateSession(session.id, { basePoints: val } as any);
                        }}
                        className="flex-1 accent-indigo-600"
                      />
                      <span className="w-16 text-center font-black text-indigo-600 bg-indigo-50 py-2 rounded-lg border border-indigo-100">{basePoints}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold italic">
                      * Điểm thưởng tốc độ sẽ được tính thêm tối đa 50% số điểm này.
                    </p>
                  </div>

                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-slate-800 transition-all active:scale-95 mt-4"
                  >
                    ĐÓNG CÀI ĐẶT
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Alerts (Toasts) */}
          <div className="fixed top-8 right-8 z-[200] flex flex-col gap-3">
            {studentAlerts.map(alert => (
              <div key={alert.id} className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300 border border-red-400">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <LucideAlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase opacity-70">CẢNH BÁO VI PHẠM</p>
                  <p className="text-sm font-bold">
                    <span className="text-yellow-300">{alert.name}</span>{' '}
                    {alert.reason === 'COPY' ? 'vừa SAO CHÉP NỘI DUNG' :
                      alert.reason === 'TAB_SWITCH' ? 'vừa CHUYỂN TAB/ỨNG DỤNG' :
                        alert.reason === 'SCREENSHOT' ? 'vừa CHỤP ẢNH MÀN HÌNH' :
                          alert.reason}
                  </p>
                </div>
              </div>
            ))}
            {!isOnline && (
              <div className="bg-amber-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right duration-300">
                <LucideWifiOff className="w-5 h-5" />
                <p className="text-sm font-bold uppercase">Mất kết nối Internet - Đang chờ đồng bộ</p>
              </div>
            )}
          </div>


          {/* Hidden canvas for screen sharing frame capture (separate from drawing canvas) */}
          <canvas ref={screenCaptureCanvasRef} className="hidden" />

          {/* Detailed Report Modal */}
          {showReportModal && (
            <div className="absolute inset-0 z-[110] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-white rounded-[3rem] w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden text-slate-900 font-sans">
                <div className="p-8 border-b flex justify-between items-center bg-slate-50">
                  <div>
                    <h3 className="text-2xl font-black flex items-center gap-3">
                      <LucideFlag className="text-indigo-600" /> BÁO CÁO CHI TIẾT BUỔI HỌC
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Tổng cộng {responses.length} lượt phản hồi</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                    >
                      <LucideDownload className="w-4 h-4" /> XUẤT CSV
                    </button>
                    <button onClick={() => setShowReportModal(false)} className="p-3 hover:bg-slate-200 rounded-full text-slate-400 transition-all border border-slate-200"><LucideX /></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="space-y-10">
                    {session.slides.map((s, sIdx) => {
                      const slideQuestions = s.questions || [];
                      if (slideQuestions.length === 0) return null;

                      return (
                        <div key={s.id} className="space-y-4">
                          <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4">
                            <span className="text-3xl font-black text-slate-200">{sIdx + 1}</span>
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">{s.title || `Slide ${sIdx + 1}`}</h4>
                          </div>

                          {slideQuestions.map((q) => {
                            const qResponses = responses.filter(r => r.questionId === q.id);
                            return (
                              <div key={q.id} className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100">
                                <div className="flex justify-between items-start mb-6">
                                  <p className="font-bold text-slate-700 max-w-2xl">{q.prompt}</p>
                                  <span className="bg-white px-4 py-1.5 rounded-full text-[10px] font-black text-indigo-500 border border-indigo-100">{qResponses.length} PHẢN HỒI</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {qResponses.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic col-span-full">Chưa có câu trả lời nào cho câu hỏi này.</p>
                                  ) : qResponses.map((r, rIdx) => {
                                    let isCorrect = false;
                                    if (q.type === QuestionType.SHORT_ANSWER) {
                                      const studentAns = String(r.answer || '').trim().toLowerCase();
                                      const correctAns = String(q.correctAnswer).trim().toLowerCase();
                                      isCorrect = studentAns === correctAns;
                                    } else {
                                      isCorrect = JSON.stringify(r.answer) === JSON.stringify(q.correctAnswer);
                                    }

                                    return (
                                      <div key={rIdx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-400 uppercase">{r.studentName}</span>
                                          {isCorrect ? (
                                            <LucideCheckCircle2 className="w-4 h-4 text-green-500" />
                                          ) : (
                                            <LucideX className="w-4 h-4 text-red-500" />
                                          )}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                          {typeof r.answer === 'object' ? JSON.stringify(r.answer) : r.answer}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="bg-slate-900 border-t border-white/5 px-3 py-2 flex items-center justify-between gap-2">
          {/* Left: Slide navigation */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button disabled={currentSlideIndex === 0} onClick={() => changeSlide(currentSlideIndex - 1)} className="p-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all disabled:opacity-30"><LucideChevronLeft className="w-4 h-4" /></button>
            <div className="flex items-center px-3 h-9 bg-black/40 rounded-xl text-white font-black text-xs">
              {currentSlideIndex + 1} / {session.slides.length}
            </div>
            <button disabled={currentSlideIndex === session.slides.length - 1} onClick={() => changeSlide(currentSlideIndex + 1)} className="p-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all disabled:opacity-30"><LucideChevronRight className="w-4 h-4" /></button>
          </div>

          {/* Center: Question + main actions */}
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {totalQuestions > 0 && (
              <div className="flex items-center gap-1">
                {totalQuestions > 1 && (
                  <div className="flex items-center gap-0.5 bg-white/5 rounded-xl px-1.5 h-9 border border-white/10">
                    <button
                      disabled={activeQuestionIndex === 0}
                      onClick={() => {
                        // Close current question if active
                        if (isQuestionActive) {
                          setIsQuestionActive(false);
                          stopTimer();
                          socket.emit('question:state', { isActive: false, questionId: null });
                          dataService.updateSession(session.id, { activeQuestionId: null });
                        }
                        setActiveQuestionIndex(prev => prev - 1);
                        setShowStats(false);
                        setIsAnswerRevealed(false);
                        setQuestionStartTime(null);
                      }}
                      className="p-1 text-white hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all"
                    >
                      <LucideChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-white font-black text-[10px] px-1 min-w-[45px] text-center">
                      Câu {activeQuestionIndex + 1}/{totalQuestions}
                    </span>
                    <button
                      disabled={activeQuestionIndex === totalQuestions - 1}
                      onClick={() => {
                        // Close current question if active
                        if (isQuestionActive) {
                          setIsQuestionActive(false);
                          stopTimer();
                          socket.emit('question:state', { isActive: false, questionId: null });
                          dataService.updateSession(session.id, { activeQuestionId: null });
                        }
                        setActiveQuestionIndex(prev => prev + 1);
                        setShowStats(false);
                        setIsAnswerRevealed(false);
                        setQuestionStartTime(null);
                      }}
                      className="p-1 text-white hover:bg-white/10 rounded-lg disabled:opacity-30 transition-all"
                    >
                      <LucideChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeQuestion && (
                  <button
                    onClick={toggleQuestion}
                    className={`flex items-center gap-1.5 h-9 px-4 rounded-xl font-black text-xs transition-all shadow-lg ${isQuestionActive ? 'bg-red-500 text-white' : 'bg-green-600 text-white'}`}
                  >
                    {isQuestionActive ? <LucideStopCircle className="w-4 h-4" /> : <LucidePlayCircle className="w-4 h-4" />}
                    <span>{isQuestionActive ? 'KẾT THÚC' : 'BẮT ĐẦU'}</span>
                  </button>
                )}
                {activeQuestion && !isQuestionActive && !isAnswerRevealed && (
                  <button
                    onClick={revealAnswer}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl font-black text-xs transition-all shadow-lg bg-amber-500 text-white hover:bg-amber-600 animate-pulse"
                  >
                    <LucideCheckCircle2 className="w-4 h-4" />
                    <span>HIỆN ĐÁP ÁN</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => {
                const el = document.documentElement;
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  el.requestFullscreen();
                  socket.emit('fullscreen:request', {});
                }
              }}
              className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
              title="Toàn màn hình"
            >
              <LucideMaximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowPollCreator(true)}
              className="p-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all"
              title="Bình chọn nhanh"
            >
              <LucideTrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowQAPanel(!showQAPanel)}
              className={`flex items-center gap-1 h-9 px-3 rounded-xl font-black text-xs transition-all relative ${showQAPanel ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              <LucideMessageCircle className="w-4 h-4" /> Box {qaQuestions.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-slate-900">{qaQuestions.length}</span>}
            </button>

            {/* Data group: BÁO CÁO + BXH + THỐNG KÊ */}
            <div className="flex items-center bg-white/5 rounded-xl overflow-hidden border border-white/10">
              <button onClick={() => setShowReportModal(true)} className="flex items-center gap-1 h-9 px-2.5 text-slate-400 font-bold text-[10px] hover:bg-white/10 hover:text-white transition-all" title="Báo cáo">
                <LucideFlag className="w-3.5 h-3.5" /> BÁO CÁO
              </button>
              <div className="w-px h-5 bg-white/10"></div>
              <button onClick={() => setShowLeaderboard(!showLeaderboard)} className={`flex items-center gap-1 h-9 px-2.5 font-bold text-[10px] transition-all ${showLeaderboard ? 'bg-yellow-500 text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
                <LucideTrophy className="w-3.5 h-3.5" /> BXH
              </button>
              <div className="w-px h-5 bg-white/10"></div>
              <button onClick={() => setShowStats(!showStats)} className="flex items-center gap-1 h-9 px-2.5 text-slate-400 font-bold text-[10px] hover:bg-white/10 hover:text-white transition-all">
                <LucideChartBar className="w-3.5 h-3.5" /> TK
              </button>
            </div>

            {/* Tools group: GỌI TÊN + TRÒ CHƠI */}
            <div className="flex items-center gap-1">
              <button onClick={() => setShowRandomPicker(true)} className="flex items-center gap-1 h-9 bg-cyan-600 text-white px-3 rounded-xl font-bold text-[10px] hover:bg-cyan-700 transition-all" title="Gọi tên ngẫu nhiên">
                <LucideDice6 className="w-3.5 h-3.5" /> GỌI TÊN
              </button>
              <button onClick={() => setShowGame(true)} className="flex items-center gap-1 h-9 bg-purple-600 text-white px-3 rounded-xl font-bold text-[10px] hover:bg-purple-700 transition-all" title="Trò chơi">
                <LucideGamepad2 className="w-3.5 h-3.5" /> GAME
              </button>
            </div>

            <button onClick={exportToPDF} className="p-2 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all" title="Xuất PDF"><LucideDownload className="w-4 h-4" /></button>
            <div className="relative group">
              <button className="p-2 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all" title="Phím tắt">⌨️</button>
              <div className="absolute bottom-full mb-2 right-0 bg-slate-800 border border-white/10 rounded-xl p-4 hidden group-hover:block shadow-2xl z-50 w-52">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phím tắt</p>
                <div className="space-y-1.5 text-xs text-white font-bold">
                  <div className="flex justify-between"><span>Slide trước/sau</span><span className="text-slate-400">← →</span></div>
                  <div className="flex justify-between"><span>Bật/tắt câu hỏi</span><span className="text-slate-400">Space</span></div>
                  <div className="flex justify-between"><span>Bảng xếp hạng</span><span className="text-slate-400">L</span></div>
                  <div className="flex justify-between"><span>Thoát toàn MH</span><span className="text-slate-400">Esc</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Focus + Settings + Exit */}
          <div className="flex items-center gap-1.5 border-l border-white/10 pl-2 shrink-0">
            <button
              onClick={toggleFocusMode}
              className={`flex items-center gap-1 px-3 h-9 rounded-xl font-bold text-[10px] tracking-wider transition-all ${isFocusMode ? 'bg-orange-500 text-white animate-pulse' : 'bg-white/5 text-slate-400 hover:text-white'}`}
            >
              {isFocusMode ? <LucideLock className="w-3.5 h-3.5" /> : <LucideUnlock className="w-3.5 h-3.5 text-slate-500" />}
              {isFocusMode ? 'TẬP TRUNG' : 'TT: TẮT'}
            </button>
            <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all" title="Cài đặt"><LucideSettings className="w-4 h-4" /></button>
            <button
              onClick={() => {
                if (!window.confirm('Bạn có chắc chắn muốn KẾT THÚC buổi học? Hành động này sẽ thông báo cho tất cả học sinh.')) return;
                socket.emit('session:end', { leaderboard: calculateLeaderboard() });
                onExit();
              }}
              className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 border border-red-500/30 transition-all"
              title="Kết thúc buổi học"
            >
              <LucideFlag className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Random Picker Overlay */}
      {showRandomPicker && (
        <RandomPicker
          students={joinedStudents.map((s: any) => ({ name: s.name, class: s.class }))}
          onClose={() => setShowRandomPicker(false)}
        />
      )}

      {/* Game Overlay */}
      {showGame && (
        <MillionaireGame
          onClose={() => setShowGame(false)}
          socket={socket}
          roomCode={session.roomCode}
          joinedStudents={joinedStudents}
        />
      )}
    </>
  );
};

export default PresentationView;
