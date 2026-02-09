import React from 'react';

const Fireworks: React.FC = () => {
  return (
    <div className="fireworks-container">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="firework"></div>
      ))}
      <style>{`
        .fireworks-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          pointer-events: none;
        }
        .firework {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          opacity: 1;
          background-color: #fff; /* Initial particle */
          animation: launch 1s ease-out forwards;
          left: ${Math.random() * 100}%;
          top: ${Math.random() * 50 + 50}%;
          animation-delay: ${Math.random() * 2}s;
        }
        @keyframes launch {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(-300px) scale(0); opacity: 0; }
        }
        .firework::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 150px;
          height: 150px;
          border-radius: 50%;
          opacity: 0;
          animation: explode 0.6s ease-out forwards;
          animation-delay: 1s; /* Match launch duration */
          background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(250,204,21,0.6) 30%, rgba(103,232,249,0.4) 60%, rgba(103,232,249,0) 100%);
        }
        @keyframes explode {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Fireworks;
