import React, { useEffect, useState } from 'react';

interface TimerProps {
  seconds: number;
  onTimeUp: () => void;
  isPaused: boolean;
}

const Timer: React.FC<TimerProps> = ({ seconds, onTimeUp, isPaused }) => {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    setTimeLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (isPaused || timeLeft <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft(prevTime => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, isPaused]);

  useEffect(() => {
    if (timeLeft === 0) {
      onTimeUp();
    }
  }, [timeLeft, onTimeUp]);
  
  const isUrgent = timeLeft <= 5;
  const animation = isUrgent ? 'animate-pulse' : '';
  
  const stateClasses = {
    fill: isUrgent ? 'fill-red-700/80' : 'fill-blue-800/80',
    stroke: isUrgent ? 'stroke-red-400' : 'stroke-cyan-400',
    textColor: 'text-white'
  };

  return (
    <div className="relative w-28 h-32 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 115" preserveAspectRatio="none">
            <path 
            d="M 50 0 L 100 28.87 L 100 86.63 L 50 115.5 L 0 86.63 L 0 28.87 Z"
            className={`${stateClasses.fill} ${stateClasses.stroke} transition-colors duration-500`}
            strokeWidth="3"
            />
        </svg>
        <span className={`relative text-5xl font-bold ${stateClasses.textColor} ${animation}`}>{timeLeft}</span>
    </div>
  );
};

export default Timer;