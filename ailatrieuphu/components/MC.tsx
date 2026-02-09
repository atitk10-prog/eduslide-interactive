import React from 'react';

interface MCProps {
  status: 'default' | 'thinking' | 'correct' | 'wrong';
}

const MC: React.FC<MCProps> = ({ status }) => {
  const Face = () => {
    switch (status) {
      case 'thinking':
        return (
          <>
            {/* Eyes - Focused */}
            <path d="M 38 27 Q 40 26, 42 27" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <path d="M 58 27 Q 60 26, 62 27" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <circle cx="40" cy="28" r="1.8" fill="#2c3e50" />
            <circle cx="60" cy="28" r="1.8" fill="#2c3e50" />
            {/* Mouth - Neutral */}
            <path d="M 48 37 L 55 37" stroke="#4a372a" strokeWidth="1" fill="none" />
          </>
        );
      case 'correct':
        return (
          <>
            {/* Eyes - Happy Squint */}
            <path d="M 38 28 Q 40 25, 42 28" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <path d="M 58 28 Q 60 25, 62 28" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <circle cx="40" cy="28" r="1.8" fill="#2c3e50" />
            <circle cx="60" cy="28" r="1.8" fill="#2c3e50" />
            {/* Mouth - Big Smile */}
            <path d="M 46 35 Q 51 40, 56 35" stroke="#4a372a" strokeWidth="1.5" fill="none" />
          </>
        );
      case 'wrong':
        return (
          <>
            {/* Eyes - Sad */}
            <path d="M 38 29 Q 40 31, 42 29" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <path d="M 58 29 Q 60 31, 62 29" stroke="#2c3e50" strokeWidth="1.2" fill="none" />
            <circle cx="40" cy="28.5" r="1.8" fill="#2c3e50" />
            <circle cx="60" cy="28.5" r="1.8" fill="#2c3e50" />
            {/* Mouth - Frown */}
            <path d="M 48 38 Q 51 34, 54 38" stroke="#4a372a" strokeWidth="1" fill="none" />
          </>
        );
      default: // 'default'
        return (
          <>
            {/* Eyebrows */}
            <path d="M 37 25 Q 40 24, 43 25" stroke="#4a372a" strokeWidth="1" fill="none" />
            <path d="M 57 25 Q 60 24, 63 25" stroke="#4a372a" strokeWidth="1" fill="none" />
            {/* Eyes */}
            <circle cx="40" cy="28" r="3.5" fill="white" stroke="#a0a0a0" strokeWidth="0.5"/>
            <circle cx="60" cy="28" r="3.5" fill="white" stroke="#a0a0a0" strokeWidth="0.5"/>
            <circle cx="40" cy="28" r="1.8" fill="#2c3e50" />
            <circle cx="60" cy="28" r="1.8" fill="#2c3e50" />
            {/* Mouth - Gentle Smile */}
            <path d="M 47 36 Q 51 38, 55 36" stroke="#4a372a" strokeWidth="1" fill="none" />
          </>
        );
    }
  };

  const Arms = () => {
    switch (status) {
        case 'thinking':
            return (
                <>
                    {/* Left arm resting */}
                    <path d="M 20 55 L 10 80 L 30 85 Z" fill="#001f3f"/>
                    {/* Right arm to chin */}
                    <g transform="translate(5, 5)">
                        <path d="M 80 55 L 70 40 L 55 42 L 60 60 Z" fill="#001f3f"/>
                        <circle cx="65" cy="38" r="8" fill="#ffddc1"/>
                    </g>
                </>
            );
        case 'correct':
            return (
                <>
                    {/* Left arm resting */}
                    <path d="M 20 55 L 10 80 L 30 85 Z" fill="#001f3f"/>
                    {/* Right arm thumbs up */}
                     <g transform="translate(15, 0)">
                        <path d="M 80 60 L 70 85 L 90 90 Z" fill="#001f3f"/>
                        <path d="M 88 88 C 80 80, 75 70, 80 65 L 90 70 C 95 75, 95 85, 88 88 Z" fill="#ffddc1"/>
                        <path d="M 78 63 L 75 58 L 83 60 Z" fill="#ffddc1"/>
                    </g>
                </>
            );
        case 'wrong':
            return (
                 <>
                    {/* Both arms gesturing outwards */}
                    <path d="M 20 55 L 5 70 L 25 75 Z" fill="#001f3f"/>
                    <path d="M 80 55 L 95 70 L 75 75 Z" fill="#001f3f"/>
                    <circle cx="5" cy="70" r="8" fill="#ffddc1"/>
                    <circle cx="95" cy="70" r="8" fill="#ffddc1"/>
                </>
            );
        default: // 'default'
            return (
                <>
                    {/* Clasped hands over desk */}
                    <path d="M 20 55 L 30 80 L 45 82 Z" fill="#001f3f"/>
                    <path d="M 80 55 L 70 80 L 55 82 Z" fill="#001f3f"/>
                    <path d="M 45 80 C 50 75, 60 75, 65 80 L 50 90 Z" fill="#ffddc1"/>
                </>
            );
    }
  }


  return (
    <div className="relative w-56 h-64 md:w-64 md:h-72">
      {/* Chair */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-[70%] bg-[#8d6e63] rounded-t-xl" />
      
      {/* Desk Monitor */}
      <div className="absolute bottom-[20%] left-1/2 -translate-x-[120%] w-[50%] h-[40%] bg-black rounded-sm border-2 border-gray-600 -rotate-12 transform">
        <div className="w-full h-full bg-blue-900 opacity-50"/>
      </div>

      {/* Character */}
      <div className="absolute bottom-[0] left-1/2 -translate-x-1/2 w-48 h-60">
        <svg viewBox="0 0 100 125" className="w-full h-full">
            <defs>
                <radialGradient id="headGradient" cx="0.5" cy="0.4" r="0.6">
                    <stop offset="0%" stopColor="#ffe8d1" />
                    <stop offset="100%" stopColor="#ffddc1" />
                </radialGradient>
                 <linearGradient id="suitGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#001f3f" />
                    <stop offset="50%" stopColor="#003366" />
                    <stop offset="100%" stopColor="#001f3f" />
                </linearGradient>
            </defs>

            {/* Torso (Suit Jacket) */}
            <path d="M 20 120 L 20 50 C 20 30, 80 30, 80 50 L 80 120 Z" fill="url(#suitGradient)" />
            {/* White Shirt */}
            <path d="M 50 40 L 65 55 L 35 55 Z" fill="#ecf0f1"/>
            {/* Red Tie */}
            <path d="M 50 53 L 55 68 L 45 68 Z" fill="#c0392b"/>
            <path d="M 47 50 C 48 45, 52 45, 53 50 Z" fill="#c0392b" />

            {/* Arms - Dynamic based on status */}
            <Arms />

            {/* Head */}
            <g transform={`translate(${status === 'thinking' ? -2 : 0}, 5)`}>
                <circle cx="50" cy="25" r="25" fill="url(#headGradient)"/>
                {/* Hair */}
                <path d="M 25 10 C 20 -10, 80 -10, 75 10 C 85 25, 60 40, 50 35 C 40 40, 15 25, 25 10 Z" fill="#2c3e50"/>
                <path d="M 30 5 C 40 -5, 60 -5, 70 5" stroke="rgba(255,255,255,0.2)" strokeWidth="2" fill="none"/>
                
                {/* Facial Features - Dynamic */}
                <Face />
            </g>
        </svg>
      </div>
    </div>
  );
};

export default MC;