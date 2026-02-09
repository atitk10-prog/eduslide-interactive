import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LucideX, LucidePlay, LucideLoader2, LucideCheck, LucideSkipForward, LucideTrophy, LucideRefreshCw, LucideSparkles, LucideAlertTriangle, LucideUsers, LucideFileText } from 'lucide-react';
import { dataService } from '../../services/dataService';
import WordImporter from './WordImporter';

// Types
interface GameQuestion {
    question: string;
    options: string[];
    correctAnswerIndex: number;
}

type Difficulty = 'Dễ' | 'Vừa' | 'Khó';
type GamePhase = 'SETUP' | 'LOADING' | 'REVIEW' | 'PLAYING' | 'QUESTION_RESULT' | 'GAME_OVER';

interface PlayerResult {
    name: string;
    class?: string;
    correct: number;
    total: number;
    totalTimeMs: number;
}

interface MillionaireGameProps {
    onClose: () => void;
    socket: any;
    roomCode: string;
    joinedStudents: any[];
}

const PRIZE_LEVELS = ["100", "200", "300", "500", "1,000", "2,000", "4,000", "8,000", "16,000", "32,000", "64,000", "125,000", "250,000", "500,000", "1,000,000"];
const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

const MillionaireGame: React.FC<MillionaireGameProps> = ({ onClose, socket, roomCode, joinedStudents }) => {
    // Setup state
    const [topic, setTopic] = useState('');
    const [questionCount, setQuestionCount] = useState(10);
    const [difficulty, setDifficulty] = useState<Difficulty>('Vừa');
    const [timerDuration, setTimerDuration] = useState(30);
    const [apiKey, setApiKey] = useState('');

    // Game state
    const [phase, setPhase] = useState<GamePhase>('SETUP');
    const [questions, setQuestions] = useState<GameQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [error, setError] = useState('');
    const [answersReceived, setAnswersReceived] = useState<Record<string, { answer: number; timeMs: number }>>({});
    const [leaderboard, setLeaderboard] = useState<PlayerResult[]>([]);
    const [showCorrect, setShowCorrect] = useState(false);
    const [showWordImporter, setShowWordImporter] = useState(false);

    const timerRef = useRef<number | null>(null);

    // Load API key from Supabase
    useEffect(() => {
        const loadKey = async () => {
            const key = await dataService.getNextApiKey();
            if (key) setApiKey(key);
        };
        loadKey();
    }, []);

    // Listen for student answers
    useEffect(() => {
        const handleAnswer = (data: { studentName: string; answer: number; timeMs: number }) => {
            setAnswersReceived(prev => ({
                ...prev,
                [data.studentName]: { answer: data.answer, timeMs: data.timeMs }
            }));
        };

        socket.on('game:answer', handleAnswer);
        return () => socket.off('game:answer', handleAnswer);
    }, [socket]);

    // Timer
    useEffect(() => {
        if (phase === 'PLAYING' && timeLeft > 0) {
            timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
        }
        if (phase === 'PLAYING' && timeLeft === 0 && questions.length > 0) {
            // Time up — reveal answer
            revealAnswer();
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [phase, timeLeft]);

    const fetchQuestions = useCallback(async () => {
        if (!topic.trim()) return;
        const keyToUse = apiKey || await dataService.getNextApiKey();
        if (!keyToUse) {
            setError('Chưa có API key. Vui lòng thêm key trong phần Cài đặt.');
            return;
        }

        setPhase('LOADING');
        setError('');

        try {
            const { GoogleGenAI, Type } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: keyToUse });

            let difficultyPrompt = "The difficulty must increase progressively from very easy to extremely hard.";
            if (difficulty === 'Dễ') difficultyPrompt = "The difficulty must increase progressively, starting from very easy and ending with medium.";
            if (difficulty === 'Khó') difficultyPrompt = "The difficulty must increase progressively, starting from medium and ending with expert-level.";

            const contents = `Generate ${questionCount} trivia questions for a 'Who Wants to Be a Millionaire?' style game, in Vietnamese. The topic is "${topic}". ${difficultyPrompt} For each question, provide the question text, four multiple-choice options (A, B, C, D), and the index of the correct answer (0-3).`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING, description: 'The question text in Vietnamese.' },
                                options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 4 possible answers in Vietnamese.' },
                                correctAnswerIndex: { type: Type.INTEGER, description: 'The index (0-3) of the correct answer.' },
                            },
                            required: ["question", "options", "correctAnswerIndex"],
                        },
                    },
                },
            });

            const parsed = JSON.parse(response.text?.trim() || '[]') as GameQuestion[];
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid response');
            setQuestions(parsed);
            setPhase('REVIEW');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Lỗi tạo câu hỏi');
            setPhase('SETUP');
        }
    }, [topic, questionCount, difficulty, apiKey]);

    const startGame = () => {
        setCurrentIndex(0);
        setLeaderboard([]);
        setPhase('PLAYING');
        setTimeLeft(timerDuration);
        setAnswersReceived({});
        setShowCorrect(false);

        // Broadcast to students
        socket.emit('game:start', {
            roomCode,
            totalQuestions: questions.length,
            timerDuration,
        });

        // Send first question
        socket.emit('game:question', {
            roomCode,
            index: 0,
            question: questions[0].question,
            options: questions[0].options,
            timerDuration,
        });
    };

    const revealAnswer = () => {
        setShowCorrect(true);
        setPhase('QUESTION_RESULT');
        if (timerRef.current) clearTimeout(timerRef.current);

        const currentQ = questions[currentIndex];
        // Broadcast reveal
        socket.emit('game:reveal', {
            roomCode,
            correctIndex: currentQ.correctAnswerIndex,
        });

        // Update leaderboard
        setLeaderboard(prev => {
            const updated = [...prev];
            (Object.entries(answersReceived) as [string, { answer: number; timeMs: number }][]).forEach(([name, val]) => {
                const { answer, timeMs } = val;
                let player = updated.find(p => p.name === name);
                if (!player) {
                    player = { name, correct: 0, total: 0, totalTimeMs: 0 };
                    updated.push(player);
                }
                player.total++;
                player.totalTimeMs += timeMs;
                if (answer === currentQ.correctAnswerIndex) player.correct++;
            });
            // Sort: most correct first, then fastest
            return updated.sort((a, b) => b.correct - a.correct || a.totalTimeMs - b.totalTimeMs);
        });
    };

    const nextQuestion = () => {
        const nextIdx = currentIndex + 1;
        if (nextIdx >= questions.length) {
            setPhase('GAME_OVER');
            socket.emit('game:end', { roomCode, leaderboard });
            return;
        }

        setCurrentIndex(nextIdx);
        setTimeLeft(timerDuration);
        setAnswersReceived({});
        setShowCorrect(false);
        setPhase('PLAYING');

        socket.emit('game:question', {
            roomCode,
            index: nextIdx,
            question: questions[nextIdx].question,
            options: questions[nextIdx].options,
            timerDuration,
        });
    };

    const prizeLevels = PRIZE_LEVELS.slice(0, questions.length);
    const currentQ = questions[currentIndex];

    // ============ RENDER ============

    if (phase === 'SETUP') {
        return (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
                <div className="bg-gradient-to-br from-indigo-950 via-blue-950 to-purple-950 rounded-3xl shadow-2xl w-full max-w-lg p-8 relative border border-indigo-700/30">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white p-2"><LucideX className="w-6 h-6" /></button>

                    <div className="text-center mb-6">
                        <h2 className="text-3xl font-black text-yellow-400">🎮 AI LÀ TRIỆU PHÚ</h2>
                        <p className="text-indigo-300 text-sm mt-1">{joinedStudents.length} học sinh đang chờ</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Chủ đề câu hỏi</label>
                            <input value={topic} onChange={e => setTopic(e.target.value)}
                                className="w-full bg-white/10 border border-indigo-600/50 rounded-xl p-3 text-white placeholder-white/30 outline-none focus:border-yellow-400"
                                placeholder="Ví dụ: Lịch sử Việt Nam, Toán lớp 9..." />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Số câu</label>
                                <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                                    className="w-full bg-white/10 border border-indigo-600/50 rounded-xl p-3 text-white outline-none">
                                    {[5, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Độ khó</label>
                                <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                                    className="w-full bg-white/10 border border-indigo-600/50 rounded-xl p-3 text-white outline-none">
                                    <option value="Dễ">Dễ</option>
                                    <option value="Vừa">Vừa</option>
                                    <option value="Khó">Khó</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Timer (s)</label>
                                <select value={timerDuration} onChange={e => setTimerDuration(Number(e.target.value))}
                                    className="w-full bg-white/10 border border-indigo-600/50 rounded-xl p-3 text-white outline-none">
                                    {[15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n}s</option>)}
                                </select>
                            </div>
                        </div>

                        {!apiKey && (
                            <div>
                                <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Gemini API Key</label>
                                <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                                    className="w-full bg-white/10 border border-indigo-600/50 rounded-xl p-3 text-white placeholder-white/30 outline-none font-mono text-sm"
                                    placeholder="AIzaSy..." />
                            </div>
                        )}

                        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl p-3 flex items-center gap-2"><LucideAlertTriangle className="w-4 h-4" />{error}</p>}

                        <button onClick={fetchQuestions} disabled={!topic.trim()}
                            className="w-full bg-yellow-500 text-black font-black py-4 rounded-2xl text-lg hover:bg-yellow-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                            <LucideSparkles className="w-5 h-5" /> TẠO CÂU HỎI BẰNG AI
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-indigo-400 text-xs font-bold">HOẶC</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>
                        <button onClick={() => setShowWordImporter(true)}
                            className="w-full bg-white/10 text-white font-bold py-3 rounded-2xl text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2 border border-white/10">
                            <LucideFileText className="w-5 h-5" /> IMPORT TỪ FILE WORD (.docx)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'LOADING') {
        return (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center">
                <div className="text-center text-white">
                    <LucideLoader2 className="w-16 h-16 animate-spin text-yellow-400 mx-auto mb-4" />
                    <p className="text-2xl font-bold">Đang tạo câu hỏi bằng AI...</p>
                    <p className="text-indigo-300 mt-2">Chủ đề: {topic} • {questionCount} câu • {difficulty}</p>
                </div>
            </div>
        );
    }

    if (phase === 'REVIEW') {
        return (
            <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4">
                <div className="bg-gradient-to-br from-indigo-950 via-blue-950 to-purple-950 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-indigo-700/30">
                    <div className="p-6 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-yellow-400">📋 XEM LẠI CÂU HỎI</h2>
                            <p className="text-indigo-300 text-sm">{questions.length} câu hỏi • {topic}</p>
                        </div>
                        <button onClick={onClose} className="text-white/50 hover:text-white p-2"><LucideX className="w-6 h-6" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {questions.map((q, i) => (
                            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                                <p className="text-yellow-400 font-bold text-sm mb-1">Câu {i + 1} / {questions.length}</p>
                                <p className="text-white font-semibold mb-2">{q.question}</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {q.options.map((opt, j) => (
                                        <div key={j} className={`px-3 py-2 rounded-lg text-sm font-medium ${j === q.correctAnswerIndex ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/5 text-white/70'
                                            }`}>
                                            <span className="font-bold mr-1">{ANSWER_LABELS[j]}:</span> {opt}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-white/10">
                        <button onClick={startGame}
                            className="w-full bg-green-500 text-white font-black py-4 rounded-2xl text-lg hover:bg-green-400 transition-all flex items-center justify-center gap-2">
                            <LucidePlay className="w-6 h-6" /> BẮT ĐẦU TRÒ CHƠI
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'PLAYING' || phase === 'QUESTION_RESULT') {
        const answerCount = Object.keys(answersReceived).length;
        const correctCount = Object.values(answersReceived).filter((a: { answer: number; timeMs: number }) => a.answer === currentQ.correctAnswerIndex).length;

        return (
            <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-blue-950 to-black z-[200] flex flex-col">
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 py-3 bg-black/30">
                    <div className="flex items-center gap-3">
                        <span className="text-yellow-400 font-black text-lg">Câu {currentIndex + 1}/{questions.length}</span>
                        <span className="text-white/40">•</span>
                        <span className="text-indigo-300 text-sm font-bold">{topic}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                            <LucideUsers className="w-4 h-4 text-cyan-400" />
                            <span className="text-white font-bold text-sm">{answerCount} / {joinedStudents.length} đã trả lời</span>
                        </div>
                        <div className={`text-3xl font-black tabular-nums w-16 text-center rounded-xl py-1 ${timeLeft <= 5 ? 'text-red-400 animate-pulse bg-red-500/20' : 'text-yellow-400 bg-yellow-500/10'}`}>
                            {timeLeft}
                        </div>
                    </div>
                </div>

                {/* Timer bar */}
                <div className="h-1.5 bg-white/10">
                    <div className={`h-full transition-all duration-1000 linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{ width: `${(timeLeft / timerDuration) * 100}%` }} />
                </div>

                {/* Prize ladder sidebar */}
                <div className="flex-1 flex">
                    <div className="w-48 bg-black/30 py-4 overflow-y-auto hidden lg:block">
                        {prizeLevels.map((prize, i) => {
                            const idx = prizeLevels.length - 1 - i;
                            return (
                                <div key={idx} className={`px-4 py-1.5 text-sm font-bold flex justify-between ${idx === currentIndex ? 'bg-yellow-500/30 text-yellow-400' : idx < currentIndex ? 'text-green-400/50' : 'text-white/30'
                                    }`}>
                                    <span>{idx + 1}</span>
                                    <span>${prize}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Question area */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
                        <div className="bg-gradient-to-r from-indigo-900/80 via-indigo-800/80 to-indigo-900/80 border-2 border-yellow-500/30 rounded-2xl px-10 py-6 max-w-3xl w-full text-center">
                            <p className="text-white text-xl md:text-2xl font-bold leading-relaxed">{currentQ.question}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 max-w-3xl w-full">
                            {currentQ.options.map((opt, i) => {
                                let bg = 'bg-indigo-800/50 hover:bg-indigo-700/50 border-indigo-600/30';
                                if (showCorrect) {
                                    if (i === currentQ.correctAnswerIndex) bg = 'bg-green-600/80 border-green-400 scale-105';
                                    else bg = 'bg-red-900/30 border-red-500/20 opacity-60';
                                }
                                return (
                                    <div key={i} className={`${bg} border-2 rounded-xl px-6 py-4 transition-all duration-300 flex items-center gap-3`}>
                                        <span className="text-yellow-400 font-black text-lg w-8">{ANSWER_LABELS[i]}</span>
                                        <span className="text-white font-semibold text-base">{opt}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Answer stats */}
                        {showCorrect && (
                            <div className="bg-black/40 rounded-2xl p-4 max-w-md w-full text-center animate-fade-in">
                                <p className="text-green-400 font-bold text-lg">{correctCount} / {answerCount} trả lời đúng ({answerCount > 0 ? Math.round(correctCount / answerCount * 100) : 0}%)</p>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-3">
                            {phase === 'PLAYING' && (
                                <button onClick={revealAnswer}
                                    className="flex items-center gap-2 bg-yellow-500 text-black font-black py-3 px-8 rounded-2xl hover:bg-yellow-400 transition-all">
                                    <LucideCheck className="w-5 h-5" /> HIỆN ĐÁP ÁN
                                </button>
                            )}
                            {phase === 'QUESTION_RESULT' && (
                                <button onClick={nextQuestion}
                                    className="flex items-center gap-2 bg-green-500 text-white font-black py-3 px-8 rounded-2xl hover:bg-green-400 transition-all">
                                    <LucideSkipForward className="w-5 h-5" /> {currentIndex + 1 >= questions.length ? 'KẾT THÚC' : 'CÂU TIẾP'}
                                </button>
                            )}
                            <button onClick={() => { socket.emit('game:end', { roomCode, leaderboard }); setPhase('GAME_OVER'); }}
                                className="flex items-center gap-2 bg-red-500/20 text-red-400 font-bold py-3 px-6 rounded-2xl hover:bg-red-500/30 border border-red-500/30">
                                <LucideX className="w-5 h-5" /> DỪNG
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (phase === 'GAME_OVER') {
        return (
            <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-black z-[200] flex items-center justify-center p-4">
                <div className="bg-black/40 rounded-3xl border border-yellow-500/20 w-full max-w-lg p-8 text-center">
                    <h2 className="text-4xl font-black text-yellow-400 mb-2">🏆 KẾT THÚC</h2>
                    <p className="text-indigo-300 mb-6">{topic} • {questions.length} câu hỏi</p>

                    {leaderboard.length > 0 ? (
                        <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                            {leaderboard.slice(0, 10).map((p, i) => (
                                <div key={p.name} className={`flex items-center justify-between px-4 py-3 rounded-xl ${i === 0 ? 'bg-yellow-500/20 border border-yellow-500/30' : i === 1 ? 'bg-slate-500/20' : i === 2 ? 'bg-amber-800/20' : 'bg-white/5'
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-lg font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-500' : 'text-white/50'}`}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                                        </span>
                                        <span className="text-white font-bold">{p.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-green-400 font-bold">{p.correct}/{p.total}</span>
                                        <span className="text-white/30 text-xs ml-2">{(p.totalTimeMs / 1000).toFixed(1)}s</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-white/50 mb-6">Không có học sinh nào tham gia</p>
                    )}

                    <div className="flex gap-3 justify-center">
                        <button onClick={() => { setPhase('SETUP'); setQuestions([]); }}
                            className="flex items-center gap-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-2xl hover:bg-indigo-500">
                            <LucideRefreshCw className="w-5 h-5" /> CHƠI LẠI
                        </button>
                        <button onClick={onClose}
                            className="flex items-center gap-2 bg-white/10 text-white font-bold py-3 px-6 rounded-2xl hover:bg-white/20 border border-white/20">
                            <LucideX className="w-5 h-5" /> ĐÓNG
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Word import handler
    const handleWordImport = (imported: GameQuestion[]) => {
        setQuestions(imported);
        setShowWordImporter(false);
        setPhase('REVIEW');
    };

    return (
        <>
            {showWordImporter && (
                <WordImporter
                    onImport={handleWordImport}
                    onClose={() => setShowWordImporter(false)}
                />
            )}
        </>
    );
};

export default MillionaireGame;
