import React, { useState, useRef } from 'react';
import { LucideUpload, LucideFileText, LucideX, LucideCheck, LucideAlertTriangle, LucideEdit3, LucideTrash2, LucideLoader2 } from 'lucide-react';

interface ParsedQuestion {
    question: string;
    options: string[];
    correctAnswerIndex: number;
}

interface WordImporterProps {
    onImport: (questions: ParsedQuestion[]) => void;
    onClose: () => void;
}

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

const WordImporter: React.FC<WordImporterProps> = ({ onImport, onClose }) => {
    const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const parseWordFile = async (file: File) => {
        setLoading(true);
        setError('');
        setFileName(file.name);

        try {
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value;

            // Parse HTML to extract questions
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const allText = doc.body.innerHTML;

            // Strategy: split by question numbers (1. 2. 3. etc)
            // Each question block has: question line, then A. B. C. D. options
            // Correct answer is indicated by underline (<u>...</u>) or bold (<strong>...</strong>)

            const parsed: ParsedQuestion[] = [];

            // Get all paragraphs
            const paragraphs = Array.from(doc.body.querySelectorAll('p'));
            let currentQuestion = '';
            let currentOptions: { text: string; isCorrect: boolean }[] = [];

            const flushQuestion = () => {
                if (currentQuestion && currentOptions.length >= 2) {
                    const correctIdx = currentOptions.findIndex(o => o.isCorrect);
                    parsed.push({
                        question: currentQuestion.trim(),
                        options: currentOptions.map(o => o.text.trim()),
                        correctAnswerIndex: correctIdx >= 0 ? correctIdx : 0,
                    });
                }
                currentQuestion = '';
                currentOptions = [];
            };

            for (const p of paragraphs) {
                const text = p.textContent?.trim() || '';
                const html = p.innerHTML;

                if (!text) continue;

                // Check if it's a question line (starts with number + dot or parenthesis)
                const questionMatch = text.match(/^(?:Câu\s+)?(\d+)[.):\s]/i);
                // Check if it's an option line (starts with A. B. C. D.)
                const optionMatch = text.match(/^([A-Da-d])[.):\s]/);

                if (questionMatch && !optionMatch) {
                    flushQuestion();
                    currentQuestion = text.replace(/^(?:Câu\s+)?\d+[.):\s]\s*/, '');
                } else if (optionMatch) {
                    const optText = text.replace(/^[A-Da-d][.):\s]\s*/, '');
                    // Check if this option contains underline or bold (=correct)
                    const isCorrect = html.includes('<u>') || html.includes('<strong>') || html.includes('text-decoration: underline');
                    currentOptions.push({ text: optText, isCorrect });
                } else if (currentQuestion && currentOptions.length === 0) {
                    // Continuation of question text 
                    currentQuestion += ' ' + text;
                }
            }
            flushQuestion();

            // If paragraph-based parsing didn't work, try text-based
            if (parsed.length === 0) {
                const plainText = doc.body.textContent || '';
                const lines = plainText.split('\n').map(l => l.trim()).filter(l => l);

                for (const line of lines) {
                    const questionMatch = line.match(/^(?:Câu\s+)?(\d+)[.):\s]/i);
                    const optionMatch = line.match(/^([A-Da-d])[.):\s]/);

                    if (questionMatch && !optionMatch) {
                        flushQuestion();
                        currentQuestion = line.replace(/^(?:Câu\s+)?\d+[.):\s]\s*/, '');
                    } else if (optionMatch) {
                        const optText = line.replace(/^[A-Da-d][.):\s]\s*/, '');
                        // Check in original HTML for underline on this text
                        const escaped = optText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const isCorrect = new RegExp(`<u>[^<]*${escaped}`, 'i').test(allText) ||
                            new RegExp(`<strong>[^<]*${escaped}`, 'i').test(allText);
                        currentOptions.push({ text: optText, isCorrect });
                    }
                }
                flushQuestion();
            }

            if (parsed.length === 0) {
                setError('Không tìm thấy câu hỏi nào. Đảm bảo file có dạng:\n1. Câu hỏi?\nA. Đáp án A\nB. Đáp án B (gạch chân = đáp án đúng)\nC. Đáp án C\nD. Đáp án D');
            } else {
                setQuestions(parsed);
            }
        } catch (err) {
            setError('Lỗi đọc file: ' + (err instanceof Error ? err.message : 'Unknown'));
        }
        setLoading(false);
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.docx') || file.name.endsWith('.doc'))) {
            parseWordFile(file);
        } else {
            setError('Chỉ hỗ trợ file .docx');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseWordFile(file);
    };

    const removeQuestion = (index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    };

    const setCorrectAnswer = (qIndex: number, aIndex: number) => {
        setQuestions(prev => prev.map((q, i) => i === qIndex ? { ...q, correctAnswerIndex: aIndex } : q));
    };

    const handleImport = () => {
        if (questions.length > 0) {
            // Pad questions with fewer than 4 options
            const padded = questions.map(q => ({
                ...q,
                options: [...q.options, ...Array(Math.max(0, 4 - q.options.length)).fill('')].slice(0, 4),
            }));
            onImport(padded);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <LucideFileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Import từ Word</h2>
                            <p className="text-xs text-slate-500">.docx • Gạch chân = đáp án đúng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><LucideX className="w-5 h-5 text-slate-400" /></button>
                </div>

                {/* Upload area */}
                {questions.length === 0 && (
                    <div className="p-6">
                        <div
                            onDragOver={e => e.preventDefault()}
                            onDrop={handleFileDrop}
                            onClick={() => fileRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all"
                        >
                            {loading ? (
                                <div className="text-blue-500">
                                    <LucideLoader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                                    <p className="font-bold">Đang phân tích {fileName}...</p>
                                </div>
                            ) : (
                                <>
                                    <LucideUpload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                    <p className="font-bold text-slate-600">Kéo thả file Word hoặc bấm để chọn</p>
                                    <p className="text-xs text-slate-400 mt-2">Hỗ trợ .docx</p>
                                </>
                            )}
                        </div>
                        <input ref={fileRef} type="file" accept=".docx,.doc" onChange={handleFileSelect} className="hidden" />

                        {error && (
                            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                <LucideAlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
                            </div>
                        )}

                        {/* Format guide */}
                        <div className="mt-4 bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Định dạng file mẫu</p>
                            <div className="text-sm text-slate-600 space-y-1 font-mono">
                                <p>1. Thủ đô của Việt Nam là gì?</p>
                                <p>A. TP.HCM</p>
                                <p>B. <u>Hà Nội</u> ← (gạch chân)</p>
                                <p>C. Đà Nẵng</p>
                                <p>D. Huế</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Preview questions */}
                {questions.length > 0 && (
                    <>
                        <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-600">
                                <span className="text-blue-600">{questions.length}</span> câu hỏi từ <span className="text-blue-600">{fileName}</span>
                            </p>
                            <button onClick={() => { setQuestions([]); setFileName(''); }} className="text-xs text-slate-400 hover:text-red-500 font-bold">
                                Chọn file khác
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
                            {questions.map((q, qi) => (
                                <div key={qi} className="bg-slate-50 rounded-xl p-3 border border-slate-200 group">
                                    <div className="flex items-start justify-between mb-2">
                                        <p className="text-sm font-bold text-slate-900">
                                            <span className="text-blue-500 mr-1">{qi + 1}.</span> {q.question}
                                        </p>
                                        <button onClick={() => removeQuestion(qi)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg transition-all">
                                            <LucideTrash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {q.options.map((opt, ai) => (
                                            <button
                                                key={ai}
                                                onClick={() => setCorrectAnswer(qi, ai)}
                                                className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${ai === q.correctAnswerIndex
                                                        ? 'bg-green-100 text-green-800 border border-green-300'
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:border-green-300'
                                                    }`}
                                            >
                                                <span className="font-bold mr-1">{ANSWER_LABELS[ai]}.</span>
                                                {opt}
                                                {ai === q.correctAnswerIndex && <LucideCheck className="w-3 h-3 inline ml-1 text-green-600" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 border-t">
                            <button
                                onClick={handleImport}
                                className="w-full bg-green-500 text-white font-black py-3.5 rounded-2xl hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                            >
                                <LucideCheck className="w-5 h-5" /> IMPORT {questions.length} CÂU HỎI
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WordImporter;
