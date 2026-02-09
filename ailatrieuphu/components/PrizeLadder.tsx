import React, { useState, useEffect } from 'react';
import { AppState } from '../types';

interface PrizeLadderProps {
  currentQuestionIndex: number;
  prizeLevels: string[];
  safeLevels: number[];
  appState: AppState;
  onAnimationComplete?: () => void;
}

const PrizeLadder: React.FC<PrizeLadderProps> = ({ currentQuestionIndex, prizeLevels, safeLevels, appState, onAnimationComplete }) => {
  const reversedLevels = [...prizeLevels].reverse();
  const totalQuestions = prizeLevels.length;

  const isPlaying = appState === AppState.PLAYING || appState === AppState.ANSWER_SELECTED || appState === AppState.GAME_OVER;
  const [isInitialAnimationDone, setIsInitialAnimationDone] = useState(false);
  const [highlightSafeLevels, setHighlightSafeLevels] = useState(false);

  useEffect(() => {
    const shouldAnimate = appState === AppState.GAME_START && !isInitialAnimationDone;
    if (shouldAnimate) {
      const totalDelay = totalQuestions * 50;

      const highlightTimer = setTimeout(() => {
        setHighlightSafeLevels(true);
      }, totalDelay + 200);

      const endAnimationTimer = setTimeout(() => {
        setHighlightSafeLevels(false);
        setIsInitialAnimationDone(true);
        onAnimationComplete?.();
      }, totalDelay + 200 + 1500); // Highlight for 1.5s

      return () => {
        clearTimeout(highlightTimer);
        clearTimeout(endAnimationTimer);
      };
    }
  }, [appState, isInitialAnimationDone, totalQuestions, onAnimationComplete]);

  // Reset animation state if game resets to creator screen
  useEffect(() => {
    if (appState === AppState.CREATOR) {
      setIsInitialAnimationDone(false);
    }
  }, [appState]);

  const shouldShowInstantly = isPlaying || (appState === AppState.GAME_START && isInitialAnimationDone);

  return (
    <div className="w-full p-2 bg-blue-900 bg-opacity-70 border-2 border-cyan-500 rounded-lg text-white font-bold h-full flex flex-col justify-center">
      <ul className="space-y-1">
        {reversedLevels.map((prize, index) => {
          const questionNumber = totalQuestions - index;
          const questionIndex = questionNumber - 1;
          const isActive = currentQuestionIndex === questionIndex;
          const isSafe = safeLevels.includes(questionIndex);
          const isPassed = currentQuestionIndex > questionIndex;
          
          const getLevelClasses = () => {
            if (highlightSafeLevels && isSafe) {
                return 'bg-cyan-500 text-black scale-110 shadow-lg';
            }
            if (isActive) {
                return 'bg-yellow-500 text-black scale-105';
            }
            if (isSafe) {
                if (isPassed) {
                    return 'font-extrabold text-green-400'; // Passed safe level
                }
                return 'font-extrabold text-yellow-400'; // Default safe level
            }
            return 'text-gray-300'; // Default for non-safe, non-active
          };

          return (
            <li
              key={prize}
              className={`
                flex justify-between items-center px-4 py-1 rounded-md transform transition-all duration-500
                ${(shouldShowInstantly) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                ${getLevelClasses()}
              `}
              style={{
                transitionDelay: !shouldShowInstantly ? `${(totalQuestions - 1 - index) * 50}ms` : '0ms'
              }}
            >
              <span className={isActive ? 'text-black' : 'text-yellow-400'}>{questionNumber}</span>
              <span>{prize}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PrizeLadder;