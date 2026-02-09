
import React from 'react';

interface AudiencePollModalProps {
  pollData: { option: string; percentage: number }[];
  onClose: () => void;
}

const AudiencePollModal: React.FC<AudiencePollModalProps> = ({ pollData, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
      <div className="bg-blue-900 border-2 border-cyan-400 rounded-lg p-8 w-11/12 md:w-1/2 lg:w-1/3 text-white">
        <h2 className="text-2xl font-bold text-center text-yellow-400 mb-6">Ý kiến khán giả</h2>
        <div className="flex justify-around items-end h-64 space-x-4">
          {pollData.map((data, index) => (
            <div key={index} className="flex flex-col items-center h-full justify-end">
              <div className="text-lg font-bold mb-2">{`${data.percentage}%`}</div>
              <div
                className="w-12 md:w-16 bg-cyan-500 rounded-t-lg transition-all duration-1000"
                style={{ height: `${data.percentage}%` }}
              ></div>
              <div className="mt-2 text-xl font-bold text-yellow-400">{data.option}</div>
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <button
            onClick={onClose}
            className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-full hover:bg-yellow-600 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AudiencePollModal;
