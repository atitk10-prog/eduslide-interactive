
import React, { useEffect, useState } from 'react';

interface PhoneFriendModalProps {
  suggestion: string;
  onClose: () => void;
}

const PhoneFriendModal: React.FC<PhoneFriendModalProps> = ({ suggestion, onClose }) => {
  const [thinking, setThinking] = useState(true);
  const [message, setMessage] = useState("Đang kết nối...");
  
  useEffect(() => {
    setTimeout(() => setMessage("Hmm, để tôi suy nghĩ..."), 1000);
    setTimeout(() => {
      setMessage(`Tôi nghĩ câu trả lời là... ${suggestion}.`);
      setThinking(false);
    }, 3000);
  }, [suggestion]);
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-blue-900 border-2 border-cyan-400 rounded-lg p-8 w-11/12 md:w-1/2 lg:w-1/3 text-white text-center">
        <h2 className="text-2xl font-bold text-yellow-400 mb-6">Gọi điện thoại cho người thân</h2>
        <div className="flex justify-center items-center h-24">
            <p className="text-xl italic">{message}</p>
        </div>
        <div className="text-center mt-8">
          <button
            onClick={onClose}
            disabled={thinking}
            className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-full hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            Cảm ơn
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhoneFriendModal;
