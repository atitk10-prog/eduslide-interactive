import React, { useState, useEffect, useRef } from 'react';
import { LucideClock, LucideTrophy, LucideCheck, LucideX } from 'lucide-react';

interface MillionaireStudentProps {
    socket: any;
    studentName: string;
    onGameEnd: () => void;
}

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];
const ANSWER_COLORS = [
    'from-blue-600 to-blue-700',
    'from-amber-600 to-amber-700',
    'from-green-600 to-green-700',
    'from-red-600 to-red-700',
];

const MillionaireStudent: React.FC<MillionaireStudentProps> = ({ socket, studentName, onGameEnd }) => {
    const [gameStarted, setGameStarted] = useState(false);
    const [question, setQuestion] = useState<{ question: string; options: string[]; index: number } | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [correctIndex, setCorrectIndex] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [totalTime, setTotalTime] = useState(30);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const answerTimeRef = useRef<number>(0);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const handleStart = (data: any) => {
            setGameStarted(true);
            setTotalQuestions(data.totalQuestions || 0);
            setScore({ correct: 0, total: 0 });
            setLeaderboard(null);
        };

        const handleQuestion = (data: any) => {
            setQuestion({ question: data.question, options: data.options, index: data.index });
            setSelectedAnswer(null);
            setCorrectIndex(null);
            setTimeLeft(data.timerDuration || 30);
            setTotalTime(data.timerDuration || 30);
            answerTimeRef.current = Date.now();
        };

        const handleReveal = (data: any) => {
            setCorrectIndex(data.correctIndex);
            if (timerRef.current) clearInterval(timerRef.current);

            setScore(prev => ({
                correct: prev.correct + (selectedAnswer === data.correctIndex ? 1 : 0),
                total: prev.total + 1,
            }));
        };

        const handleEnd = (data: any) => {
            setLeaderboard(data.leaderboard || []);
            setGameStarted(false);
            setQuestion(null);
        };

        socket.on('game:start', handleStart);
        socket.on('game:question', handleQuestion);
        socket.on('game:reveal', handleReveal);
        socket.on('game:end', handleEnd);

        return () => {
            socket.off('game:start', handleStart);
            socket.off('game:question', handleQuestion);
            socket.off('game:reveal', handleReveal);
            socket.off('game:end', handleEnd);
        };
    }, [socket, selectedAnswer]);

    // Timer countdown
    useEffect(() => {
        if (question && timeLeft > 0 && selectedAnswer === null) {
            timerRef.current = window.setTimeout(() => setTimeLeft(t => t - 1), 1000);
        }
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [question, timeLeft, selectedAnswer]);

    const handleSelect = (index: number) => {
        if (selectedAnswer !== null || correctIndex !== null) return;
        setSelectedAnswer(index);
        const elapsed = Date.now() - answerTimeRef.current;
        if (timerRef.current) clearTimeout(timerRef.current);

        socket.emit('game:answer', {
            studentName,
            answer: index,
            timeMs: elapsed,
        });
    };

    // Leaderboard view (game ended)
    if (leaderboard) {
        const myRank = leaderboard.findIndex((p: any) => p.name === studentName) + 1;
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-950 to-black text-white">
                <h2 className="text-3xl font-black text-yellow-400 mb-2">🏆 KẾT QUẢ</h2>
                <p className="text-indigo-300 mb-4">Bạn đúng {score.correct}/{score.total} câu</p>

                {myRank > 0 && (
                    <div className={`text-5xl font-black mb-4 ${myRank === 1 ? 'text-yellow-400' : myRank === 2 ? 'text-slate-300' : myRank === 3 ? 'text-amber-500' : 'text-white'}`}>
                        {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
                    </div>
                )}

                <div className="w-full max-w-sm space-y-2 max-h-48 overflow-y-auto">
                    {leaderboard.slice(0, 5).map((p: any, i: number) => (
                        <div key={i} className={`flex justify-between px-4 py-2 rounded-xl text-sm ${p.name === studentName ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-white/5'}`}>
                            <span className="font-bold">{i + 1}. {p.name}</span>
                            <span className="text-green-400 font-bold">{p.correct}/{p.total}</span>
                        </div>
                    ))}
                </div>

                <button onClick={onGameEnd} className="mt-6 bg-indigo-600 text-white font-bold py-3 px-8 rounded-2xl hover:bg-indigo-500">
                    QUAY LẠI
                </button>
            </div>
        );
    }

    // Waiting for game to start
    if (!gameStarted && !question) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-indigo-950 to-black text-white">
                <div className="animate-pulse text-6xl mb-4">🎮</div>
                <h2 className="text-2xl font-black text-yellow-400">AI LÀ TRIỆU PHÚ</h2>
                <p className="text-indigo-300 mt-2">Đang chờ giáo viên bắt đầu...</p>
                <p className="text-white/50 text-sm mt-1">Xin chào, {studentName}</p>
            </div>
        );
    }

    // Question view
    if (question) {
        const timerPercent = (timeLeft / totalTime) * 100;
        return (
            <div className="h-full flex flex-col bg-gradient-to-b from-indigo-950 to-black text-white p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-yellow-400 font-black">Câu {question.index + 1}{totalQuestions > 0 ? `/${totalQuestions}` : ''}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-green-400 font-bold text-sm">{score.correct} đúng</span>
                        <div className={`text-2xl font-black tabular-nums px-3 py-1 rounded-xl ${timeLeft <= 5 ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-yellow-400 bg-yellow-500/10'}`}>
                            {timeLeft}
                        </div>
                    </div>
                </div>

                {/* Timer bar */}
                <div className="h-1.5 bg-white/10 rounded-full mb-4 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 rounded-full ${timeLeft <= 5 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{ width: `${timerPercent}%` }} />
                </div>

                {/* Question */}
                <div className="bg-white/10 border border-indigo-600/30 rounded-2xl px-5 py-4 mb-4">
                    <p className="text-center font-bold text-lg leading-relaxed">{question.question}</p>
                </div>

                {/* Options */}
                <div className="flex-1 grid grid-cols-1 gap-3">
                    {question.options.map((opt, i) => {
                        let classes = `bg-gradient-to-r ${ANSWER_COLORS[i]} border-transparent`;

                        if (correctIndex !== null) {
                            if (i === correctIndex) classes = 'bg-green-500 border-green-400 scale-[1.02]';
                            else if (i === selectedAnswer && i !== correctIndex) classes = 'bg-red-600 border-red-400 opacity-70';
                            else classes = 'bg-white/5 border-white/10 opacity-40';
                        } else if (selectedAnswer === i) {
                            classes = 'bg-indigo-500 border-indigo-300 ring-2 ring-indigo-300';
                        }

                        return (
                            <button
                                key={i}
                                onClick={() => handleSelect(i)}
                                disabled={selectedAnswer !== null || correctIndex !== null || timeLeft === 0}
                                className={`${classes} border-2 rounded-xl px-5 py-4 text-left font-semibold text-white transition-all duration-300 flex items-center gap-3 active:scale-95 disabled:active:scale-100`}
                            >
                                <span className="bg-black/20 w-9 h-9 rounded-lg flex items-center justify-center font-black text-lg shrink-0">{ANSWER_LABELS[i]}</span>
                                <span className="flex-1">{opt}</span>
                                {correctIndex !== null && i === correctIndex && <LucideCheck className="w-6 h-6 text-white shrink-0" />}
                                {correctIndex !== null && i === selectedAnswer && i !== correctIndex && <LucideX className="w-6 h-6 text-white shrink-0" />}
                            </button>
                        );
                    })}
                </div>

                {/* Status */}
                {selectedAnswer !== null && correctIndex === null && (
                    <div className="text-center mt-4 text-indigo-300 text-sm font-bold animate-pulse">
                        Đã gửi câu trả lời, chờ kết quả...
                    </div>
                )}
                {timeLeft === 0 && selectedAnswer === null && correctIndex === null && (
                    <div className="text-center mt-4 text-red-400 font-bold">
                        ⏰ Hết giờ! Chờ đáp án...
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default MillionaireStudent;
