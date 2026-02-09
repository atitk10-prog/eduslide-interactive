import React, { useState, useEffect, useRef } from 'react';
import { PlayIcon } from './Icons';
import { audioService } from '../services/audioService';

interface PlayerSelectionProps {
  onPlayerSelected: (playerName: string) => void;
  playerInput: string;
  onPlayerInputChange: (newInput: string) => void;
}

const PlayerSelection: React.FC<PlayerSelectionProps> = ({ onPlayerSelected, playerInput, onPlayerInputChange }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [congratsVisible, setCongratsVisible] = useState(false);
  
  const selectionIntervalRef = useRef<number | null>(null);
  const currentNameRef = useRef<HTMLHeadingElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onPlayerInputChange(e.target.value);
  };

  const handleSelectClick = () => {
    audioService.playSound('click');
    const playerNames = playerInput.split('\n').map(name => name.trim()).filter(name => name);
    if (playerNames.length === 0) return;

    setIsSelecting(true);
    
    let selectionCounter = 0;
    const totalSelections = 20 + Math.floor(Math.random() * 10);
    
    selectionIntervalRef.current = window.setInterval(() => {
      audioService.playSound('move');
      if (currentNameRef.current) {
        currentNameRef.current.textContent = playerNames[selectionCounter % playerNames.length];
      }
      selectionCounter++;
      if (selectionCounter > totalSelections) {
        if (selectionIntervalRef.current) clearInterval(selectionIntervalRef.current);
        const winner = playerNames[Math.floor(Math.random() * playerNames.length)];
        setSelectedPlayer(winner);
        audioService.playSound('win');
        if (currentNameRef.current) {
            currentNameRef.current.textContent = winner;
        }
        setIsSelecting(false);
        setTimeout(() => setCongratsVisible(true), 500);
      }
    }, 100);
  };
  
  useEffect(() => {
    // Reset component state when playerInput changes (e.g., after playing again)
    setIsSelecting(false);
    setSelectedPlayer(null);
    setCongratsVisible(false);
    if(selectionIntervalRef.current) {
      clearInterval(selectionIntervalRef.current)
    }
      return () => {
          if (selectionIntervalRef.current) {
              clearInterval(selectionIntervalRef.current);
          }
      }
  }, [playerInput]);

  const handleReadyClick = () => {
    if (selectedPlayer) {
      audioService.playSound('click');
      onPlayerSelected(selectedPlayer);
    }
  };

  if (selectedPlayer && congratsVisible) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-white text-center p-4 animate-fade-in">
        <h1 className="text-3xl md:text-5xl font-bold text-cyan-300">Xin chúc mừng người chơi</h1>
        <p className="text-5xl md:text-7xl font-bold text-yellow-400 my-8 animate-pulse uppercase">{selectedPlayer}</p>
        <button
          onClick={handleReadyClick}
          className="bg-yellow-500 text-black font-bold py-4 px-8 rounded-full text-2xl flex items-center gap-3 transition-transform transform hover:scale-110"
        >
          <PlayIcon className="w-8 h-8"/>
          Sẵn sàng
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col justify-center items-center h-full text-white p-4">
      <div className="w-full max-w-lg bg-black bg-opacity-40 p-8 rounded-2xl border border-cyan-700 shadow-lg">
        <h1 className="text-4xl font-bold text-center text-yellow-400 mb-4">Chọn Người Chơi</h1>
        <p className="text-center text-cyan-300 mb-6">Nhập danh sách người chơi, mỗi người một dòng.</p>
        
        {isSelecting || selectedPlayer ? (
           <div className="text-center h-64 flex flex-col justify-center items-center">
               <p className="text-xl text-cyan-300 mb-4">
                {isSelecting ? 'Đang chọn ngẫu nhiên...' : 'Người chơi được chọn là...'}
               </p>
               <h2 ref={currentNameRef} className="text-5xl font-bold text-yellow-400 transition-all duration-100 h-16">
                   {/* Name will be injected here */}
               </h2>
           </div>
        ) : (
            <>
                <textarea
                    value={playerInput}
                    onChange={handleInputChange}
                    rows={8}
                    className="w-full bg-blue-900 bg-opacity-50 border border-cyan-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Tên người chơi 1&#10;Tên người chơi 2&#10;..."
                    aria-label="Player name input"
                />

                <button
                    onClick={handleSelectClick}
                    disabled={!playerInput.trim()}
                    className="mt-6 w-full bg-yellow-500 text-black font-bold py-3 px-4 rounded-full text-xl flex items-center justify-center gap-3 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                >
                    Chọn ngẫu nhiên
                </button>
            </>
        )}
      </div>
    </div>
  );
};

export default PlayerSelection;