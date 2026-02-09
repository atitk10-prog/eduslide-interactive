

import React, { useState } from 'react';
import { DEFAULT_GAME_CONFIG, MIN_QUESTIONS, MAX_QUESTIONS } from '../constants';
import { GameConfig, Difficulty } from '../types';
import { audioService } from '../services/audioService';

interface GameCreatorProps {
  onCreate: (config: GameConfig) => void;
  isLoading: boolean;
  error: string | null;
}

const AudioFileInput: React.FC<{ label: string; onFileChange: (file: File | null) => void; accept: string }> = ({ label, onFileChange, accept }) => {
    const [fileName, setFileName] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        onFileChange(file);
        setFileName(file ? file.name : '');
    };

    return (
        <div>
            <label className="block text-sm font-medium text-cyan-300">{label}</label>
            <div className="mt-1 flex items-center">
                <label className="w-full cursor-pointer bg-blue-800 hover:bg-blue-700 text-cyan-200 text-sm font-medium py-2 px-3 rounded-md border border-cyan-600">
                    <span>{fileName || 'Chọn tệp...'}</span>
                    <input type="file" className="hidden" onChange={handleFileChange} accept={accept} />
                </label>
            </div>
        </div>
    );
};

const GameCreator: React.FC<GameCreatorProps> = ({ onCreate, isLoading, error }) => {
  const [config, setConfig] = useState({
    topic: DEFAULT_GAME_CONFIG.topic,
    questionCount: DEFAULT_GAME_CONFIG.questionCount,
    timerDuration: DEFAULT_GAME_CONFIG.timerDuration,
    difficulty: DEFAULT_GAME_CONFIG.difficulty,
  });
  
  const [audioFiles, setAudioFiles] = useState<{ correct: File | null; incorrect: File | null; background: File | null }>({
    correct: null,
    incorrect: null,
    background: null,
  });

  const handleAudioFileChange = (type: 'correct' | 'incorrect' | 'background', file: File | null) => {
    setAudioFiles(prev => ({ ...prev, [type]: file }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    audioService.playSound('click');
    
    const finalConfig: GameConfig = {
        ...config,
        questionCount: Math.max(MIN_QUESTIONS, Math.min(MAX_QUESTIONS, config.questionCount)),
        audio: {
          correct: audioFiles.correct,
          incorrect: audioFiles.incorrect,
          background: audioFiles.background,
        }
    };
    onCreate(finalConfig);
  };

  return (
    <div className="flex flex-col justify-center items-center h-full text-white p-4">
      <svg width="0" height="0">
        <defs>
          <pattern id="pattern-hex" x="0" y="0" width="70" height="40" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
            <path d="M35 20 L17.5 10 L0 20 L0 0 L17.5 10 L35 0 Z" fill="none" stroke="rgba(0, 150, 200, 0.1)" strokeWidth="0.5"></path>
            <path d="M35 20 L52.5 10 L70 20 L70 0 L52.5 10 L35 0 Z" fill="none" stroke="rgba(0, 150, 200, 0.1)" strokeWidth="0.5"></path>
            <path d="M35 20 L17.5 30 L0 20 V40 L17.5 30 L35 40 Z" fill="none" stroke="rgba(0, 150, 200, 0.1)" strokeWidth="0.5"></path>
            <path d="M35 20 L52.5 30 L70 20 V40 L52.5 30 L35 40 Z" fill="none" stroke="rgba(0, 150, 200, 0.1)" strokeWidth="0.5"></path>
          </pattern>
        </defs>
      </svg>
      
      <div className="w-full max-w-lg bg-black bg-opacity-60 p-8 rounded-2xl border border-cyan-700 shadow-lg relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.6) url(#pattern-hex)' }}>
        <div className="relative">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-yellow-400" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>
                AI LÀ TRIỆU PHÚ
            </h1>
            <p className="text-cyan-300 mt-2 text-lg">Bắt đầu bằng cách tạo bộ câu hỏi của bạn</p>
            <p className="text-cyan-400 mt-4 text-sm italic">Trò chơi được tạo bởi Thầy Tình</p>
          </div>
        
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="topic" className="block text-lg font-medium text-cyan-300">Chủ đề</label>
              <input
                type="text"
                id="topic"
                name="topic"
                value={config.topic}
                onChange={handleChange}
                placeholder="nhập chủ đề hoặc nội dung vào đây"
                className="mt-1 block w-full bg-blue-900 bg-opacity-50 border border-cyan-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                required
              />
            </div>

            <div>
              <label className="block text-lg font-medium text-cyan-300">Mức độ</label>
              <div className="mt-1 grid grid-cols-3 gap-2 rounded-lg bg-blue-900 bg-opacity-50 p-1">
                  {(['Dễ', 'Vừa', 'Khó'] as Difficulty[]).map((level) => (
                  <button
                      type="button"
                      key={level}
                      onClick={() => {
                          audioService.playSound('click');
                          setConfig(prev => ({ ...prev, difficulty: level }));
                      }}
                      className={`w-full rounded-md py-2 text-sm font-medium transition-colors
                      ${config.difficulty === level
                          ? 'bg-yellow-500 text-black shadow'
                          : 'bg-transparent text-cyan-200 hover:bg-blue-800'
                      }`}
                  >
                      {level}
                  </button>
                  ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="questionCount" className="block text-lg font-medium text-cyan-300">Số câu hỏi</label>
                  <input
                  type="number"
                  id="questionCount"
                  name="questionCount"
                  value={config.questionCount}
                  onChange={handleChange}
                  min={MIN_QUESTIONS}
                  max={MAX_QUESTIONS}
                  className="mt-1 block w-full bg-blue-900 bg-opacity-50 border border-cyan-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  required
                  />
                </div>
                <div>
                  <label htmlFor="timerDuration" className="block text-lg font-medium text-cyan-300">Thời gian (giây)</label>
                  <input
                  type="number"
                  id="timerDuration"
                  name="timerDuration"
                  value={config.timerDuration}
                  onChange={handleChange}
                  min="10"
                  max="60"
                  className="mt-1 block w-full bg-blue-900 bg-opacity-50 border border-cyan-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                  required
                  />
                </div>
            </div>

            <div className="space-y-2 rounded-lg border border-cyan-800 p-3">
                <p className="text-center text-sm font-medium text-cyan-300">Âm thanh tùy chỉnh (Tùy chọn)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <AudioFileInput label="Âm thanh đúng" onFileChange={(file) => handleAudioFileChange('correct', file)} accept="audio/*" />
                  <AudioFileInput label="Âm thanh sai" onFileChange={(file) => handleAudioFileChange('incorrect', file)} accept="audio/*" />
                  <AudioFileInput label="Nhạc nền" onFileChange={(file) => handleAudioFileChange('background', file)} accept="audio/*" />
                </div>
            </div>


            {error && <p className="text-red-400 bg-red-900 bg-opacity-50 p-3 rounded-lg text-center">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-yellow-500 text-black font-bold py-3 px-4 rounded-full text-xl flex items-center justify-center gap-3 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                  <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                      Đang tạo câu hỏi...
                  </>
              ) : (
                  "Tạo câu hỏi"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GameCreator;