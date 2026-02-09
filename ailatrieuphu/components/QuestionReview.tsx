

import React, { useState } from 'react';
import { Question, GameConfig } from '../types';
import { audioService } from '../services/audioService';

interface QuestionReviewProps {
  initialQuestions: Question[];
  onConfirm: (questions: Question[]) => void;
  onRegenerate: () => void;
  isLoading: boolean;
}

const QuestionEditor: React.FC<{ 
    question: Question; 
    index: number; 
    onUpdate: (index: number, updatedQuestion: Question) => void; 
}> = ({ question, index, onUpdate }) => {
    const handleQuestionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(index, { ...question, question: e.target.value });
    };

    const handleOptionChange = (optIndex: number, value: string) => {
        const newOptions = [...question.options];
        newOptions[optIndex] = value;
        onUpdate(index, { ...question, options: newOptions });
    };

    const handleCorrectAnswerChange = (optIndex: number) => {
        onUpdate(index, { ...question, correctAnswerIndex: optIndex });
    };
    
    return (
        <div className="bg-blue-900 bg-opacity-70 p-4 rounded-lg border border-cyan-800">
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-yellow-400">Câu hỏi {index + 1}</label>
            </div>
            <textarea
                value={question.question}
                onChange={handleQuestionTextChange}
                rows={2}
                className="w-full bg-blue-800 bg-opacity-50 border border-cyan-600 rounded-md p-2 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
            />
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center">
                        <input
                            type="radio"
                            name={`correct-answer-${index}`}
                            checked={question.correctAnswerIndex === optIndex}
                            onChange={() => handleCorrectAnswerChange(optIndex)}
                            className="h-4 w-4 text-yellow-500 bg-gray-700 border-gray-600 focus:ring-yellow-600"
                        />
                        <input
                            type="text"
                            value={option}
                            onChange={(e) => handleOptionChange(optIndex, e.target.value)}
                            className="ml-2 w-full bg-blue-800 bg-opacity-50 border border-cyan-700 rounded-md p-2 text-white text-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const QuestionReview: React.FC<QuestionReviewProps> = ({ initialQuestions, onConfirm, onRegenerate, isLoading }) => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  const handleUpdateQuestion = (index: number, updatedQuestion: Question) => {
      const newQuestions = [...questions];
      newQuestions[index] = updatedQuestion;
      setQuestions(newQuestions);
  };
  
  const handleConfirm = () => {
      audioService.playSound('click');
      onConfirm(questions);
  }

  return (
    <div className="flex flex-col h-full text-white p-4">
      <div className="text-center mb-4">
        <h1 className="text-4xl font-bold text-yellow-400">Xem & Chỉnh Sửa Câu Hỏi</h1>
        <p className="text-cyan-300 mt-2">Kiểm tra lại bộ câu hỏi trước khi bắt đầu.</p>
        <p className="text-orange-400 mt-2 text-sm italic">AI có thể mắc sai sót, yêu cầu kiểm tra lại nội dung trước khi xuất bản</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {questions.map((q, i) => (
            <QuestionEditor key={i} index={i} question={q} onUpdate={handleUpdateQuestion} />
        ))}
      </div>
      
      <div className="mt-6 flex flex-col md:flex-row justify-center items-center gap-4">
        <button
          onClick={() => {
              audioService.playSound('click');
              onRegenerate();
          }}
          disabled={isLoading}
          className="w-full md:w-auto bg-gray-600 text-white font-bold py-3 px-6 rounded-full text-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105 disabled:opacity-50"
        >
           {isLoading ? 'Đang tạo...' : 'Tạo lại bộ khác'}
        </button>
        <button
          onClick={handleConfirm}
          className="w-full md:w-auto bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-lg flex items-center justify-center gap-2 transition-transform transform hover:scale-105"
        >
          Bắt đầu chơi
        </button>
      </div>
    </div>
  );
};

export default QuestionReview;