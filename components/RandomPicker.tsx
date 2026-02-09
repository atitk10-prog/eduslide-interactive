import React, { useState, useRef, useEffect } from 'react';
import { LucideX, LucideDice6, LucideRefreshCw } from 'lucide-react';

interface RandomPickerProps {
    students: { name: string; class?: string }[];
    onClose: () => void;
}

const RandomPicker: React.FC<RandomPickerProps> = ({ students, onClose }) => {
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<{ name: string; class?: string } | null>(null);
    const [congratsVisible, setCongratsVisible] = useState(false);
    const [calledStudents, setCalledStudents] = useState<string[]>([]);
    const currentNameRef = useRef<HTMLHeadingElement>(null);
    const intervalRef = useRef<number | null>(null);

    const availableStudents = students.filter(s => !calledStudents.includes(s.name));

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const handleSpin = () => {
        if (availableStudents.length === 0) return;

        setIsSpinning(true);
        setSelectedStudent(null);
        setCongratsVisible(false);

        let counter = 0;
        const totalSpins = 20 + Math.floor(Math.random() * 10);

        intervalRef.current = window.setInterval(() => {
            if (currentNameRef.current) {
                currentNameRef.current.textContent = availableStudents[counter % availableStudents.length].name;
            }
            counter++;
            if (counter > totalSpins) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                const winner = availableStudents[Math.floor(Math.random() * availableStudents.length)];
                setSelectedStudent(winner);
                setCalledStudents(prev => [...prev, winner.name]);
                if (currentNameRef.current) {
                    currentNameRef.current.textContent = winner.name;
                }
                setIsSpinning(false);
                setTimeout(() => setCongratsVisible(true), 400);
            }
        }, 80);
    };

    const handleReset = () => {
        setCalledStudents([]);
        setSelectedStudent(null);
        setCongratsVisible(false);
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 rounded-3xl shadow-2xl w-full max-w-lg p-8 relative overflow-hidden">
                {/* Decorative background */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-400 rounded-full translate-x-1/3 translate-y-1/3"></div>
                </div>

                {/* Close button */}
                <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-2 rounded-xl transition-colors">
                    <LucideX className="w-6 h-6" />
                </button>

                <div className="relative text-center space-y-6">
                    <div>
                        <h2 className="text-3xl font-black text-yellow-400 mb-1" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.5)' }}>🎲 GỌI TÊN</h2>
                        <p className="text-indigo-300 text-sm">
                            {availableStudents.length} / {students.length} học sinh chưa gọi
                        </p>
                    </div>

                    {/* Display area */}
                    <div className="min-h-[120px] flex flex-col items-center justify-center">
                        {!isSpinning && !selectedStudent && (
                            <p className="text-indigo-300 text-lg">Bấm nút để chọn ngẫu nhiên</p>
                        )}
                        <h2 ref={currentNameRef}
                            className={`text-4xl md:text-5xl font-black transition-all duration-100 ${congratsVisible ? 'text-yellow-400 scale-110' : 'text-white'
                                }`}
                            style={congratsVisible ? { textShadow: '0 0 30px rgba(250,204,21,0.5)' } : {}}>
                        </h2>
                        {congratsVisible && selectedStudent?.class && (
                            <p className="text-cyan-300 text-lg mt-2 font-semibold animate-fade-in">Lớp: {selectedStudent.class}</p>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleSpin}
                            disabled={isSpinning || availableStudents.length === 0}
                            className="flex items-center gap-2 bg-yellow-500 text-black font-black py-4 px-8 rounded-2xl text-lg
                transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 shadow-lg">
                            <LucideDice6 className={`w-6 h-6 ${isSpinning ? 'animate-spin' : ''}`} />
                            {selectedStudent ? 'Gọi tiếp' : 'Chọn ngẫu nhiên'}
                        </button>
                        {calledStudents.length > 0 && (
                            <button onClick={handleReset}
                                className="flex items-center gap-2 bg-white/10 text-white font-bold py-4 px-6 rounded-2xl
                  transition-all hover:bg-white/20 border border-white/20">
                                <LucideRefreshCw className="w-5 h-5" />
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Called students list */}
                    {calledStudents.length > 0 && (
                        <div className="mt-4 text-left bg-black/20 rounded-2xl p-4 max-h-32 overflow-y-auto">
                            <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-2">Đã gọi ({calledStudents.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {calledStudents.map((name, i) => (
                                    <span key={i} className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-sm">{name}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {availableStudents.length === 0 && students.length > 0 && (
                        <p className="text-yellow-400 font-bold animate-pulse">Đã gọi hết tất cả học sinh! Bấm Reset để bắt đầu lại.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RandomPicker;
