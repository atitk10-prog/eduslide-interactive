
import React, { useState, useEffect, useRef } from 'react';
import { User, Question, QuestionType } from '../types';
import { socket } from '../services/socketEmulator';
import { LucideAlertTriangle, LucideCheck, LucideCheckCircle2, LucideChevronLeft, LucideClock, LucideLayout, LucideMessageSquare, LucideSend, LucideTrophy, LucideUsers, LucideX, LucideImage, LucideHeart, LucideMessageCircle, LucideWifiOff, LucideMaximize2, LucideLock } from 'lucide-react';
import { dataService } from '../services/dataService';
import { supabase } from '../services/supabase';
import PDFSlideRenderer from './PDFSlideRenderer';

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
  const [revealData, setRevealData] = useState<any>(null);
  const [drawingPaths, setDrawingPaths] = useState<any[]>([]);
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 });
  const [isWaitingForReveal, setIsWaitingForReveal] = useState(false);

  // Gamification State
  const [level, setLevel] = useState(1);
  const [currentXP, setCurrentXP] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Q&A State
  const [qaQuestions, setQaQuestions] = useState<any[]>([]);
  const [showQAPanel, setShowQAPanel] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');

  // Quick Poll State
  const [quickPoll, setQuickPoll] = useState<any>(null);
  const [pollSelectedOption, setPollSelectedOption] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const currentPathRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showFullscreenNotice, setShowFullscreenNotice] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isCurrentlyFullscreen, setIsCurrentlyFullscreen] = useState(false);
  const [screenShareImage, setScreenShareImage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playDing = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }
    audioRef.current.play().catch(() => { });
  };

  const calculateGamification = (score: number) => {
    const newLevel = Math.floor(score / 100) + 1;
    const xp = score % 100;

    if (newLevel > level) {
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 4000);
    }
    setLevel(newLevel);
    setCurrentXP(xp);
  };



  const handleSlideChange = (data: any) => {
    setCurrentSlideIndex(data.slideIndex);
    setIsQuestionActive(false);
    setIsTimeout(false);
    setRevealData(null);
  };

  useEffect(() => {

    // Auto-rejoin from localStorage
    const checkSavedSession = async () => {
      const saved = localStorage.getItem('eduslide_student_session');
      if (saved) {
        try {
          const { roomCode: savedRoom, timestamp } = JSON.parse(saved);
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            setRoomCode(savedRoom);
            const session = await dataService.getSessionByRoomCode(savedRoom);
            if (session && session.isActive) {
              setSessionData(session);
              setCurrentSlideIndex(session.currentSlideIndex || 0);
              setIsPresentationStarted(session.isActive);
              if (session.activeQuestionId) setIsQuestionActive(true);
              setIsJoined(true);
              // Socket joining is handled by the dedicated useEffect below
              console.log("Auto-rejoined session:", savedRoom);
            }
          }
        } catch (e) {
          console.error("Error restoring session:", e);
        }
      }
    };
    checkSavedSession();
  }, []);

  // Centralized Socket Connection Logic
  useEffect(() => {
    if (isJoined && roomCode) {
      console.log("Initializing Socket connection for:", roomCode);
      socket.joinRoom(roomCode);
      socket.trackPresence({ name: user.name, class: 'N/A' });
      socket.emit('session:join', { roomCode, userName: user.name });

      return () => {
        socket.leaveRoom();
      };
    }
  }, [isJoined, roomCode, user.name]);

  // Socket Event Listeners
  useEffect(() => {
    if (!isJoined) return;

    // Screen Share Listeners
    const handleScreenFrame = (data: any) => {
      if (data && data.image) setScreenShareImage(data.image);
    };
    const handleScreenStop = () => setScreenShareImage(null);

    socket.on('screen:frame', handleScreenFrame);
    socket.on('screen:stop', handleScreenStop);

    const handleQuestionState = (data: any) => {
      setIsQuestionActive(data.isActive);
      if (data.isActive) {
        setRevealData(null);
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
              setIsWaitingForReveal(true);
              setIsTimeout(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        if (data.isTimeout) setIsTimeout(true);
        setIsQuestionActive(false);
        setIsWaitingForReveal(true);
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

    const handleQuestionReveal = (data: any) => {
      setRevealData(data);
      setIsWaitingForReveal(false);
      setIsQuestionActive(false);
      if (data.questionId) {
        const submitted = submittedAnswers[data.questionId];
        const q = sessionData?.slides[currentSlideIndex]?.questions.find((q: any) => q.id === data.questionId);
        if (submitted && q) {
          let isCorrect = false;
          if (q.type === QuestionType.SHORT_ANSWER) {
            const studentAns = String(submitted || '').trim().toLowerCase();
            const correctAns = String(data.correctAnswer).trim().toLowerCase();
            isCorrect = studentAns === correctAns;
          } else {
            isCorrect = JSON.stringify(submitted) === JSON.stringify(data.correctAnswer);
          }

          setStats(prev => ({
            correct: prev.correct + (isCorrect ? 1 : 0),
            incorrect: prev.incorrect + (isCorrect ? 0 : 1)
          }));
        }
      }
    };

    const handleDrawStart = (data: any) => {
      const { path } = data;
      currentPathRef.current = path;
      lastPointRef.current = path.points[0];
      setDrawingPaths(prev => [...prev, path]);
    };

    const handleDrawMove = (data: any) => {
      const { point } = data;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (ctx && lastPointRef.current && currentPathRef.current) {
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = currentPathRef.current.isEraser ? 'black' : currentPathRef.current.color;
        ctx.lineWidth = currentPathRef.current.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = currentPathRef.current.isEraser ? 'destination-out' : 'source-over';
        ctx.stroke();
      }
      lastPointRef.current = point;
      setDrawingPaths(prev => {
        const last = [...prev];
        if (last.length > 0) {
          last[last.length - 1].points.push(point);
        }
        return last;
      });
    };

    const handleDrawEnd = () => {
      lastPointRef.current = null;
      currentPathRef.current = null;
    };

    const handleDrawClear = () => {
      setDrawingPaths([]);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    const handleQAUpdate = (data: any) => {
      setQaQuestions(data.questions || []);
    };

    const handlePollStart = (data: any) => {
      setQuickPoll(data.poll);
      setPollSelectedOption(null);
    };

    const handlePollStop = () => {
      setQuickPoll(null);
    };

    const handlePresentationStart = async () => {
      setIsPresentationStarted(true);
      // Force a data refresh to ensure the latest slide order and questions are loaded
      if (roomCode) {
        const freshSession = await dataService.getSessionByRoomCode(roomCode);
        if (freshSession) {
          setSessionData(freshSession);
          setCurrentSlideIndex(freshSession.currentSlideIndex || 0);

          // Restore answers and gamification
          try {
            const history = await dataService.getResponses(freshSession.id);
            const myResponses = history.filter((r: any) => r.studentName === user.name);
            const restoredAnswers: Record<string, any> = {};
            let totalScore = 0;
            let correctCount = 0;
            let incorrectCount = 0;

            // Base points from session or default
            const basePoints = freshSession.basePoints || 100;

            myResponses.forEach((r: any) => {
              restoredAnswers[r.questionId] = r.answer;

              // Calculate Score
              const q = freshSession.slides.flatMap((s: any) => s.questions).find((q: any) => q.id === r.questionId);
              if (q) {
                let isCorrect = false;
                if (q.type === QuestionType.SHORT_ANSWER) {
                  const studentAns = String(r.answer || '').trim().toLowerCase();
                  const correctAns = String(q.correctAnswer).trim().toLowerCase();
                  isCorrect = studentAns === correctAns;
                } else {
                  isCorrect = JSON.stringify(r.answer) === JSON.stringify(q.correctAnswer);
                }

                if (isCorrect) {
                  correctCount++;
                  totalScore += basePoints; // Currently neglecting time bonus for restoration simplicity
                } else {
                  incorrectCount++;
                }
              }
            });

            setSubmittedAnswers(restoredAnswers);
            calculateGamification(totalScore);
            setStats({ correct: correctCount, incorrect: incorrectCount });

          } catch (err) {
            console.error("Error restoring history:", err);
          }

          if (freshSession.activeQuestionId) {
            setIsQuestionActive(true);
            const q = freshSession.slides[freshSession.currentSlideIndex]?.questions.find((q: any) => q.id === freshSession.activeQuestionId);
            if (q) {
              setTimeLeft(q.duration || 30);
            } else {
              setTimeLeft(30);
            }
          } else {
            setIsQuestionActive(false);
          }
        }
      }
    };

    const handleFullscreenRequest = () => {
      setShowFullscreenNotice(true);
    };

    const handleFocusMode = (data: { enabled: boolean }) => {
      setIsFocusMode(data.enabled);
      if (data.enabled) {
        setAlertMessage("CHẾ ĐỘ TẬP TRUNG: ĐÃ KÍCH HOẠT");
        setTimeout(() => setAlertMessage(null), 3000);
      } else {
        setAlertMessage("CHẾ ĐỘ TẬP TRUNG: ĐÃ TẮT");
        setTimeout(() => setAlertMessage(null), 3000);
      }
    };

    const handleOffline = () => setIsOnline(false);
    const handleOnline = () => {
      setIsOnline(true);
      dataService.syncOfflineData();
    };

    const handleCopy = () => {
      socket.emit('student:alert', { name: user.name, reason: 'COPY' });
      setAlertMessage("Hành động sao chép đã được báo cho giáo viên!");
      setTimeout(() => setAlertMessage(null), 3000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        socket.emit('student:alert', { name: user.name, reason: 'TAB_SWITCH' });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Basic security alerts (always on)
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        socket.emit('student:alert', { name: user.name, reason: 'SCREENSHOT' });
        setAlertMessage("Hành động chụp ảnh/in màn hình đã được báo cho giáo viên!");
        setTimeout(() => setAlertMessage(null), 3000);
      }

      // 2. Focus Mode Hard Lock
      if (isFocusMode) {
        const barredKeys = ['Tab', 'Meta', 'Alt', 'Control', 'Escape', 'F11', 'F12'];
        if (barredKeys.includes(e.key) || (e.altKey && e.key === 'Tab') || (e.metaKey)) {
          e.preventDefault();
          e.stopPropagation();
          setAlertMessage("CHẾ ĐỘ TẬP TRUNG: Bàn phím đã bị khóa!");
          setTimeout(() => setAlertMessage(null), 2000);
          return false;
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsCurrentlyFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('copy', handleCopy);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, true); // Use capture to block
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    socket.on('slide:change', handleSlideChange);
    socket.on('fullscreen:request', handleFullscreenRequest);
    socket.on('question:state', handleQuestionState);
    socket.on('session:start', handleSessionStart);
    socket.on('presentation:start', handlePresentationStart);
    socket.on('leaderboard:show', handleLeaderboardShow);
    socket.on('leaderboard:hide', handleLeaderboardHide);
    socket.on('session:end', handleSessionEnd);
    socket.on('feedback:correct', handleFeedbackCorrect);
    socket.on('question:reveal', handleQuestionReveal);
    socket.on('draw:start', handleDrawStart);
    socket.on('draw:move', handleDrawMove);
    socket.on('draw:end', handleDrawEnd);
    socket.on('draw:clear', handleDrawClear);
    socket.on('qa:update', handleQAUpdate);
    socket.on('poll:start', handlePollStart);
    socket.on('poll:stop', handlePollStop);
    socket.on('focus:mode', handleFocusMode);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('copy', handleCopy);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);

      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      socket.off('screen:frame', handleScreenFrame);
      socket.off('screen:stop', handleScreenStop);
      socket.off('slide:change', handleSlideChange);
      socket.off('fullscreen:request', handleFullscreenRequest);
      socket.off('question:state', handleQuestionState);
      socket.off('session:start', handleSessionStart);
      socket.off('presentation:start', handlePresentationStart);
      socket.off('leaderboard:show', handleLeaderboardShow);
      socket.off('leaderboard:hide', handleLeaderboardHide);
      socket.off('session:end', handleSessionEnd);
      socket.off('feedback:correct', handleFeedbackCorrect);
      socket.off('question:reveal', handleQuestionReveal);
      socket.off('draw:start', handleDrawStart);
      socket.off('draw:move', handleDrawMove);
      socket.off('draw:end', handleDrawEnd);
      socket.off('draw:clear', handleDrawClear);
      socket.off('qa:update', handleQAUpdate);
      socket.off('poll:start', handlePollStart);
      socket.off('poll:stop', handlePollStop);
      socket.leaveRoom();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomCode]); // Added roomCode to dependencies for handlePresentationStart

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
            const q = sessionData.slides[newData.current_slide_index]?.questions.find((q: any) => q.id === newData.active_question_id);
            if (q) {
              setTimeLeft(q.duration || 30);
            } else {
              setTimeLeft(30);
            }
          }
        }

        if (newData.is_active === false && sessionData.isActive === true) {
          // Might indicate session end or question stop
        }
      })
      .on('broadcast', { event: 'sync' }, (payload) => {
        const { type, data } = payload.payload;
        console.log("Realtime Broadcast Received:", type, data);
        if (type === 'slide:change') {
          setCurrentSlideIndex(data.slideIndex);
          setIsQuestionActive(false);
          setIsTimeout(false);
          setIsPresentationStarted(true);
        } else if (type === 'presentation:start') {
          setIsPresentationStarted(true);
        } else if (type === 'session:start') {
          setSessionData(data);
          setCurrentSlideIndex(data.currentSlideIndex || 0);
          setIsPresentationStarted(data.isStarted);
        } else if (type === 'question:state') {
          setIsQuestionActive(data.isActive);
          if (!data.isActive && data.isTimeout) setIsTimeout(true);
        }
      })
      .subscribe();

    // Fetch historical data
    const fetchHistory = async () => {
      if (sessionData?.id && user.name) {
        // Responses
        const history = await dataService.getResponses(sessionData.id);
        const mine = history.filter(r => r.studentName === user.name);
        if (mine.length > 0) {
          const answers: Record<string, any> = {};
          mine.forEach(r => answers[r.questionId] = r.answer);
          setSubmittedAnswers(answers);
        }

        // Q&A
        const qa = await dataService.getQAQuestions(sessionData.id);
        setQaQuestions(qa.map(q => ({
          id: q.id,
          studentName: q.student_name,
          content: q.content,
          timestamp: q.timestamp,
          upvotes: q.upvotes || [],
          isAnswered: q.is_answered,
          isFeatured: q.is_featured
        })));

        // Polls (detecting currently active poll)
        const polls = await dataService.getPolls(sessionData.id);
        const activePoll = polls.find(p => p.is_active);
        if (activePoll) {
          setQuickPoll({
            id: activePoll.id,
            prompt: activePoll.prompt,
            options: activePoll.options,
            responses: activePoll.responses || {}
          });
          if (activePoll.responses && activePoll.responses[user.name]) {
            setPollSelectedOption(activePoll.responses[user.name]);
          }
        }
      }
    };
    fetchHistory();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionData?.id, user.name]);

  const submitAnswer = async (questionId: string, answer: any) => {
    if (submittedAnswers[questionId] || isTimeout || !sessionData?.id || sessionData.id === 'sess-1') return;
    setSubmittedAnswers(prev => ({ ...prev, [questionId]: answer }));

    const response = {
      sessionId: sessionData.id,
      studentName: user.name,
      studentClass: studentClass || 'N/A',
      questionId,
      answer,
      timestamp: Date.now()
    };

    socket.emit('answer:submit', response);
    const success = await dataService.submitResponse(response);
    if (!success) {
      console.error("FAILED TO SAVE TO DB:", response);
      alert("Lỗi: Không thể lưu câu trả lời vào máy chủ. Vui lòng thử lại.");
      setSubmittedAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleJoin = async () => {
    if (!roomCode.trim()) return;

    // 1. Find session using dataService (supports Local + Supabase)
    const session = await dataService.getSessionByRoomCode(roomCode);

    if (!session) {
      alert('Không tìm thấy phòng học hoặc phòng đã đóng.');
      return;
    }

    // Help iOS/Old browsers with Fullscreen and Audio
    const element = document.documentElement;
    const requestFS = element.requestFullscreen || (element as any).webkitRequestFullscreen || (element as any).mozRequestFullScreen || (element as any).msRequestFullscreen;

    if (requestFS) {
      requestFS.call(element).catch(() => { });
    }

    // Prime audio
    playDing();

    setSessionData(session);
    setCurrentSlideIndex(session.currentSlideIndex || 0);
    setIsPresentationStarted(session.isActive);
    if (session.activeQuestionId) setIsQuestionActive(true);

    setIsJoined(true);
    // socket.joinRoom handled by useEffect when isJoined becomes true

    // Save session state for auto-rejoin
    localStorage.setItem('eduslide_student_session', JSON.stringify({
      roomCode,
      timestamp: Date.now()
    }));
  };

  const submitQAQuestion = async () => {
    if (!newQuestion.trim() || !sessionData?.id) return;

    // Save to DB first
    const saved = await dataService.submitQAQuestion(sessionData.id, user.name, newQuestion);
    if (saved) {
      const question = {
        id: saved.id,
        studentName: user.name,
        content: newQuestion,
        timestamp: Date.now(),
        upvotes: [],
        isAnswered: false,
        isFeatured: false
      };
      socket.emit('qa:submit', { roomCode, question });
      setNewQuestion('');
    } else {
      alert("Lỗi: Không thể gửi câu hỏi lúc này.");
    }
  };

  // Focus Mode Enforcement
  useEffect(() => {
    if (!isFocusMode || !isJoined) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setAlertMessage("CẢNH BÁO: BẠN ĐANG RỜI KHỎI BÀI HỌC! Vui lòng quay lại ngay.");
        socket.emit('student:violation', {
          studentName: user.name,
          reason: 'Tab Switching / Alt+Tab',
          roomCode
        });
        // Play warning sound
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3');
        audio.play().catch(() => { });
      } else {
        // Clear alert when back
        // setAlertMessage(null); 
        socket.emit('student:returned', { studentName: user.name, roomCode });
      }
    };

    const handleBlur = () => {
      // Blur can happen when clicking iframe or devtools, be careful.
      // But for kiosk mode, blur usually means alt-tab.
      if (!document.hidden) {
        setAlertMessage("CẢNH BÁO: HÃY GIỮ MÀN HÌNH TẠI ĐÂY!");
        socket.emit('student:violation', {
          studentName: user.name,
          reason: 'Window Blur / Alt+Tab',
          roomCode
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isFocusMode, isJoined, user.name, roomCode]);

  // Fullscreen Enforcement
  useEffect(() => {
    if (!isFocusMode || !isJoined) return;

    const handleFullscreenChange = () => {
      setIsCurrentlyFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        socket.emit('student:violation', {
          studentName: user.name,
          reason: 'Exited Fullscreen',
          roomCode
        });
      } else {
        socket.emit('student:returned', { studentName: user.name, roomCode });
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Auto-request fullscreen when entering focus mode (might be blocked by browser if no user interaction, so we show a button instead)
    if (!document.fullscreenElement) {
      setIsCurrentlyFullscreen(false);
    } else {
      setIsCurrentlyFullscreen(true);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFocusMode, isJoined]);

  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch(err => {
      console.error("Error enabling fullscreen:", err);
    });
  };

  const submitPollResponse = async (option: string) => {
    if (!quickPoll || pollSelectedOption) return;
    setPollSelectedOption(option);

    // Sync to DB
    await dataService.submitPollResponse(quickPoll.id, user.name, option);

    socket.emit('poll:response', {
      pollId: quickPoll.id,
      studentName: user.name,
      option
    });
  };

  const toggleUpvote = async (questionId: string) => {
    await dataService.upvoteQAQuestion(questionId, user.name);
    socket.emit('qa:upvote', { roomCode, questionId, studentName: user.name });
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
      <div className={`bg-white p-4 border-b flex justify-between items-center sticky top-0 z-10 shadow-sm transition-all ${isCurrentlyFullscreen ? '-translate-y-full' : ''}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center relative shrink-0">
            <span className="font-black text-indigo-600">L{level}</span>
            {showLevelUp && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-[8px] px-1 rounded-full animate-bounce font-black">UP!</div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 truncate max-w-[120px]">{user.name}</span>
              {streak >= 3 && <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1"><LucideImage className="w-3 h-3" /> {streak}</span>}
            </div>
            {/* XP Bar */}
            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${currentXP}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!sessionEnded && (
            <button
              onClick={() => setShowQAPanel(true)}
              className="relative p-2 text-slate-400 hover:text-indigo-600 transition-all"
            >
              <LucideMessageCircle className="w-5 h-5" />
              {qaQuestions.length > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {qaQuestions.length}
                </span>
              )}
            </button>
          )}
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
          <div className="flex items-center gap-1 ml-2">
            <div className="bg-green-100 text-green-600 px-2 py-1 rounded-lg text-[10px] font-black border border-green-200">
              ✔️ {stats.correct}
            </div>
            <div className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-[10px] font-black border border-red-200">
              ❌ {stats.incorrect}
            </div>
          </div>
        </div>
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

            {/* Waiting for Reveal State */}
            {isWaitingForReveal && !revealData && (
              <div className="bg-slate-100 p-8 rounded-[2rem] text-center animate-in fade-in zoom-in duration-300 border-4 border-slate-200 border-dashed">
                <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <LucideLock className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-black text-slate-700 uppercase mb-2">ĐÃ ĐÓNG CÂU TRẢ LỜI</h3>
                <p className="text-slate-500 font-bold">Vui lòng chờ giáo viên công bố đáp án...</p>
              </div>
            )}

            {/* Answer Result State */}
            {revealData && (
              <div className={`p-8 rounded-[2rem] text-center animate-in fade-in zoom-in duration-500 border-4 shadow-xl mb-6 ${submittedAnswers[question.id] === undefined
                ? 'bg-slate-100 border-slate-200'
                : (
                  (question.type === QuestionType.SHORT_ANSWER
                    ? String(submittedAnswers[question.id] || '').trim().toLowerCase() === String(revealData.correctAnswer).trim().toLowerCase()
                    : JSON.stringify(submittedAnswers[question.id]) === JSON.stringify(revealData.correctAnswer))
                    ? 'bg-green-100 border-green-500 text-green-800'
                    : 'bg-red-100 border-red-500 text-red-800'
                )
                }`}>
                {submittedAnswers[question.id] === undefined ? (
                  <div>
                    <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <LucideWifiOff className="w-10 h-10 text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-black uppercase mb-2">KHÔNG TRẢ LỜI</h3>
                    <p className="font-bold opacity-70">Bạn đã bỏ lỡ câu hỏi này.</p>
                  </div>
                ) : (
                  (question.type === QuestionType.SHORT_ANSWER
                    ? String(submittedAnswers[question.id] || '').trim().toLowerCase() === String(revealData.correctAnswer).trim().toLowerCase()
                    : JSON.stringify(submittedAnswers[question.id]) === JSON.stringify(revealData.correctAnswer))
                    ? (
                      <div>
                        <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200 animate-bounce">
                          <LucideCheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-black uppercase mb-2">CHÍNH XÁC!</h3>
                        <p className="font-bold opacity-70">Bạn đã nhận được điểm.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-200">
                          <LucideX className="w-10 h-10" />
                        </div>
                        <h3 className="text-3xl font-black uppercase mb-2">RẤT TIẾC!</h3>
                        <p className="font-bold opacity-70">Đáp án đúng là: <span className="underline decoration-wavy decoration-red-400">{String(revealData.correctAnswer)}</span></p>
                      </div>
                    )
                )}
              </div>
            )}

            {isTimeout && !submittedAnswers[question.id] && !isWaitingForReveal && !revealData && (
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

            {submittedAnswers[question.id] && !revealData && (
              <div className="text-center p-8 bg-green-50 rounded-[2.5rem] border border-green-100 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95">
                <div className="bg-green-500 text-white p-3 rounded-full shadow-lg shadow-green-200">
                  <LucideCheckCircle2 className="w-8 h-8" />
                </div>
                <p className="text-green-800 font-black text-lg">Đã ghi nhận câu trả lời!</p>
                <p className="text-green-600 text-sm font-medium italic">Vui lòng chờ slide tiếp theo từ giáo viên.</p>
              </div>
            )}

            {revealData && question.id === revealData.questionId && (
              <div className="animate-in zoom-in-95 duration-500">
                {(() => {
                  let isCorrect = false;
                  const submitted = submittedAnswers[question.id];
                  if (question.type === QuestionType.SHORT_ANSWER) {
                    const studentAns = String(submitted || '').trim().toLowerCase();
                    const correctAns = String(revealData.correctAnswer).trim().toLowerCase();
                    isCorrect = studentAns === correctAns;
                  } else {
                    isCorrect = JSON.stringify(submitted) === JSON.stringify(revealData.correctAnswer);
                  }

                  return isCorrect ? (
                    <div className="bg-green-500 text-white p-10 rounded-[3rem] text-center shadow-2xl border-4 border-white/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mr-16 -mt-16" />
                      <LucideTrophy className="w-20 h-20 mx-auto mb-4 animate-bounce" />
                      <h2 className="text-4xl font-black mb-2">CHÍNH XÁC!</h2>
                      <p className="text-xl font-bold opacity-80">Bạn thật xuất sắc</p>
                    </div>
                  ) : (
                    <div className="bg-red-500 text-white p-10 rounded-[3rem] text-center shadow-2xl border-4 border-white/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl -mr-16 -mt-16" />
                      <LucideX className="w-20 h-20 mx-auto mb-4 animate-pulse" />
                      <h2 className="text-4xl font-black mb-2">CHƯA ĐÚNG!</h2>
                      <p className="text-xl font-bold opacity-80 mb-4">Đừng nản chí nhé</p>
                      <div className="bg-white/20 py-4 rounded-2xl inline-block px-10">
                        <span className="text-xs font-black uppercase tracking-widest block opacity-70">Đáp án ĐÚNG: {Array.isArray(revealData.correctAnswer) ? revealData.correctAnswer.join(', ') : String(revealData.correctAnswer).replace(/[\[\]"]/g, '')}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : isPresentationStarted && currentSlide ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500">
            <div className="flex-1 w-full flex items-center justify-center relative bg-black/5 rounded-3xl overflow-hidden shadow-inner p-4 min-h-[300px]">
              {currentSlide.pdfSource ? (
                <PDFSlideRenderer url={currentSlide.pdfSource} pageNumber={currentSlide.pdfPage || 1} />
              ) : currentSlide.imageUrl ? (
                <img src={currentSlide.imageUrl} className="max-h-full max-w-full object-contain rounded-xl shadow-lg" alt="Slide" />
              ) : (
                <div className="text-slate-300 flex flex-col items-center gap-2">
                  <LucideImage className="w-12 h-12" />
                  <span className="font-bold">Đang tải slide...</span>
                </div>
              )}

              {/* Drawing Layer */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full z-10 pointer-events-none"
                width={1920}
                height={1080}
              />
            </div>

            <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-[2rem] w-full max-w-md text-center">
              <p className="text-indigo-600 font-black text-lg">Lớp học đang diễn ra</p>
              <p className="text-indigo-400 text-sm font-medium italic">Hãy theo dõi màn hình chính và trả lời khi có câu hỏi xuất hiện.</p>
            </div>
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

        {/* Q&A Side Panel (Overlay) */}
        {showQAPanel && (
          <div className="absolute inset-0 z-[100] flex animate-in fade-in duration-300">
            <div className="flex-1 bg-black/40" onClick={() => setShowQAPanel(false)} />
            <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <LucideMessageCircle className="text-indigo-600" /> HỎI ĐÁP Q&A
                </h3>
                <button onClick={() => setShowQAPanel(false)} className="p-2 hover:bg-slate-200 rounded-full transition-all">
                  <LucideX className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {qaQuestions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                    <LucideMessageSquare className="w-12 h-12 mb-4" />
                    <p className="font-bold text-sm">Chưa có câu hỏi nào.<br />Hãy là người đầu tiên!</p>
                  </div>
                ) : (
                  qaQuestions.sort((a, b) => b.upvotes.length - a.upvotes.length).map((q) => (
                    <div key={q.id} className={`p-4 rounded-2xl border-2 transition-all ${q.isFeatured ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{q.studentName}</span>
                        <span className="text-[9px] text-slate-400">{new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-700 mb-3">{q.content}</p>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleUpvote(q.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black transition-all ${q.upvotes.includes(user.name) ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-red-50'}`}
                        >
                          <LucideHeart className={`w-3 h-3 ${q.upvotes.includes(user.name) ? 'fill-current' : ''}`} />
                          {q.upvotes.length}
                        </button>
                        {q.isAnswered && (
                          <span className="text-[10px] font-black text-green-600 uppercase flex items-center gap-1">
                            <LucideCheck className="w-3 h-3" /> Đã trả lời
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t">
                <div className="relative">
                  <input
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && submitQAQuestion()}
                    placeholder="Gửi câu hỏi của bạn..."
                    className="w-full p-4 pr-12 rounded-2xl border-2 border-slate-200 outline-none focus:border-indigo-600 font-bold text-sm"
                  />
                  <button
                    onClick={submitQAQuestion}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-indigo-600 hover:bg-white rounded-xl transition-all"
                  >
                    <LucideSend className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Screen Share Overlay */}
        {screenShareImage && !isQuestionActive && (
          <div className="absolute inset-0 z-[50] bg-black flex items-center justify-center">
            <img src={screenShareImage} className="w-full h-full object-contain" alt="Teacher Screen" />
            <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-black animate-pulse flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full" /> TRỰC TIẾP TỪ GIÁO VIÊN
            </div>
          </div>
        )}

        {/* Quick Poll Overlay (Student View) */}
        {quickPoll && (
          <div className="absolute inset-0 z-[150] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
              <h3 className="text-xl font-black text-slate-800 mb-2 uppercase">BÌNH CHỌN NHANH</h3>
              <p className="text-slate-500 font-bold mb-8 italic">Hãy chọn phương án của bạn!</p>

              <div className="grid grid-cols-1 gap-3">
                {quickPoll.options.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => submitPollResponse(opt)}
                    disabled={!!pollSelectedOption}
                    className={`p-5 rounded-2xl border-2 font-black transition-all ${pollSelectedOption === opt ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : pollSelectedOption ? 'bg-slate-50 border-slate-100 text-slate-400 opacity-50' : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-600 hover:bg-indigo-50 active:scale-95 touch-manipulation'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>

              {pollSelectedOption && (
                <p className="mt-8 text-indigo-600 font-black text-sm animate-pulse">
                  Đã ghi nhận! Chờ giáo viên kết thúc...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Hard Lock Overlay (Focus Mode) */}
        {isFocusMode && !isCurrentlyFullscreen && isJoined && (
          <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-8 animate-pulse">
              <LucideAlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">MÀN HÌNH ĐÃ KHÓA</h2>
            <p className="text-slate-400 font-bold mb-10 max-w-md">
              Giáo viên đã bật <span className="text-red-500">CHẾ ĐỘ TẬP TRUNG</span>. Vui lòng quay lại chế độ Toàn màn hình để tiếp tục bài học.
            </p>
            <button
              onClick={() => {
                const el = document.documentElement;
                if (el.requestFullscreen) el.requestFullscreen();
                else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
                else if ((el as any).msRequestFullscreen) (el as any).msRequestFullscreen();
                setIsCurrentlyFullscreen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all hover:scale-105 flex items-center gap-3"
            >
              <LucideMaximize2 /> QUAY LẠI TOÀN MÀN HÌNH
            </button>
          </div>
        )}
        {/* Level Up Overlay */}
        {showLevelUp && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
            <div className="bg-yellow-400 text-slate-900 px-8 py-6 rounded-[2rem] shadow-2xl animate-bounce text-center border-4 border-white">
              <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-2">LEVEL UP!</h2>
              <p className="font-bold text-lg">Chúc mừng! Bạn đã đạt Level {level}</p>
            </div>
          </div>
        )}
      </div>
      {/* Focus Mode Fullscreen Blocker */}
      {isFocusMode && !isCurrentlyFullscreen && isJoined && (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-300">
          <LucideMaximize2 className="w-20 h-20 text-yellow-400 mb-6 animate-bounce" />
          <h2 className="text-3xl font-black text-white mb-4">CHẾ ĐỘ TẬP TRUNG ĐANG BẬT</h2>
          <p className="text-slate-400 font-bold max-w-md mb-8">
            Giáo viên yêu cầu bạn phải giữ màn hình ở chế độ Toàn màn hình. Vui lòng quay lại lớp học ngay.
          </p>
          <button
            onClick={enterFullscreen}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center gap-3"
          >
            <LucideMaximize2 className="w-6 h-6" />
            VÀO LẠI TOÀN MÀN HÌNH
          </button>
        </div>
      )}

      {/* Focus Mode Tab Switch Blocker (Visual Shame) */}
      {isFocusMode && alertMessage && (
        <div className="fixed inset-0 bg-red-600 z-[110] flex flex-col items-center justify-center p-10 text-center animate-in zoom-in duration-300">
          <LucideAlertTriangle className="w-32 h-32 text-white mb-6 animate-ping" />
          <h1 className="text-5xl font-black text-white mb-4">CẢNH BÁO VI PHẠM</h1>
          <p className="text-white/80 font-bold text-2xl max-w-2xl mb-10">
            {alertMessage}
          </p>
          <button
            onClick={() => setAlertMessage(null)}
            className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black shadow-xl"
          >
            ĐÃ HIỂU, TÔI SẼ KHÔNG TÁI PHẠM
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentView;
