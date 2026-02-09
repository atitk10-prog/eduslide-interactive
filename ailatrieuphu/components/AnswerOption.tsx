import React from 'react';

interface AnswerOptionProps {
  prefix: string;
  text: string;
  onClick: () => void;
  isSelected: boolean;
  isCorrect: boolean;
  isRevealed: boolean;
  isDisabled: boolean;
}

const AnswerOption: React.FC<AnswerOptionProps> = ({ 
  prefix, 
  text, 
  onClick, 
  isSelected, 
  isCorrect,
  isRevealed,
  isDisabled,
}) => {
  const getDynamicClasses = () => {
    let fill = 'fill-blue-800/80 group-hover:fill-cyan-700/80';
    let stroke = 'stroke-cyan-400';
    let textColor = 'text-white';

    if (isRevealed) {
      if (isCorrect) {
        fill = 'fill-green-500/90 animate-pulse';
        stroke = 'stroke-green-300';
      } else if (isSelected) { // and not correct
        fill = 'fill-red-600/90';
        stroke = 'stroke-red-300';
      } else {
        fill = 'fill-blue-900/50';
        stroke = 'stroke-blue-700';
        textColor = 'text-gray-400';
      }
    } else if (isSelected) {
      fill = 'fill-orange-500/90';
      stroke = 'stroke-orange-300';
    }
    
    return { fill, stroke, textColor };
  };

  const stateClasses = getDynamicClasses();

  const textLength = text.length;
  let textFontSizeClass = "text-xl md:text-2xl";
  if (textLength > 70) {
      textFontSizeClass = "text-base md:text-lg";
  } else if (textLength > 40) {
      textFontSizeClass = "text-lg md:text-xl";
  }

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`relative w-full min-h-20 font-bold
        flex items-center transition-all duration-300 transform group
        ${isDisabled && !isRevealed ? 'opacity-50 cursor-not-allowed' : ''}
        ${!isDisabled && !isSelected ? 'hover:scale-105' : ''}`
      }
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 250 50" preserveAspectRatio="none">
        <path 
          d="M 15 0 L 235 0 L 250 25 L 235 50 L 15 50 L 0 25 Z"
          className={`${stateClasses.fill} ${stateClasses.stroke} transition-colors duration-300`}
          strokeWidth="2"
        />
      </svg>

      <div className={`relative flex items-center justify-start w-full px-8 ${stateClasses.textColor} ${textFontSizeClass}`}>
          <span className={`mr-4 ${isSelected || isRevealed ? 'text-white' : 'text-yellow-400'}`}>{prefix}:</span>
          <span className="text-left flex-1">{text}</span>
      </div>
    </button>
  );
};

export default AnswerOption;