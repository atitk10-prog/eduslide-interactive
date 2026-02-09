import React from 'react';
import { LifelineState } from '../types';
import { FiftyFiftyIcon, PhoneIcon, AudienceIcon } from './Icons';

interface LifelinesProps {
  lifelines: LifelineState;
  onFiftyFifty: () => void;
  onPhoneAFriend: () => void;
  onAskTheAudience: () => void;
}

const LifelineButton: React.FC<{ icon: React.ReactNode; onClick: () => void; disabled: boolean }> = ({ icon, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-blue-800 bg-opacity-80 border-2 border-cyan-400 text-white
      flex items-center justify-center transition-all duration-300
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-cyan-600 hover:scale-110'}
    `}
  >
    {icon}
    {disabled && <div className="absolute inset-0 flex items-center justify-center text-red-500 text-4xl font-bold">X</div>}
  </button>
);

const Lifelines: React.FC<LifelinesProps> = ({ lifelines, onFiftyFifty, onPhoneAFriend, onAskTheAudience }) => {
  return (
    <div className="flex space-x-2 md:space-x-4">
      <LifelineButton
        icon={<FiftyFiftyIcon className="w-6 h-6 md:w-7 md:h-7" />}
        onClick={onFiftyFifty}
        disabled={!lifelines.fiftyFifty}
      />
      <LifelineButton
        icon={<PhoneIcon className="w-6 h-6 md:w-7 md:h-7" />}
        onClick={onPhoneAFriend}
        disabled={!lifelines.phoneAFriend}
      />
      <LifelineButton
        icon={<AudienceIcon className="w-6 h-6 md:w-7 md:h-7" />}
        onClick={onAskTheAudience}
        disabled={!lifelines.askTheAudience}
      />
    </div>
  );
};

export default Lifelines;