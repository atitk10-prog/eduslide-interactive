import React from 'react';
import { audioService } from '../services/audioService';

interface MilestoneModalProps {
  prize: string;
  onClose: () => void;
}

const MilestoneModal: React.FC<MilestoneModalProps> = ({ prize, onClose }) => {
  const handleContinue = () => {
    audioService.playSound('click');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-blue-900 border-2 border-cyan-400 rounded-lg p-8 w-11/12 md:w-1/2 lg:w-1/3 text-white text-center animate-fade-in">
        <h2 className="text-4xl font-bold text-yellow-400 mb-4">CHÚC MỪNG!</h2>
        <p className="text-xl text-cyan-200 mb-8">{prize}</p>
        <button
          onClick={handleContinue}
          className="bg-yellow-500 text-black font-bold py-3 px-8 rounded-full text-xl hover:bg-yellow-600 transition-colors"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
};

export default MilestoneModal;
