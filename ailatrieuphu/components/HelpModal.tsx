import React from 'react';
import { audioService } from '../services/audioService';
import { FiftyFiftyIcon, PhoneIcon, AudienceIcon } from './Icons';

const HelpModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const handleClose = () => {
    audioService.playSound('click');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 animate-fade-in">
      <div className="bg-blue-900 border-2 border-cyan-400 rounded-lg p-6 md:p-8 w-11/12 md:w-3/4 lg:w-1/2 max-w-4xl text-white max-h-[90vh] flex flex-col">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-yellow-400 mb-6 flex-shrink-0">Hướng dẫn chơi</h2>
        
        <div className="overflow-y-auto space-y-6 pr-4 text-cyan-100">
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-500">Bước 1: Tạo Bộ Câu Hỏi</h3>
                <p>Màn hình đầu tiên cho phép bạn tùy chỉnh trò chơi của mình:</p>
                <ul className="list-disc list-inside space-y-1 pl-4">
                    <li><strong className="text-white">Chủ đề:</strong> Nhập bất kỳ chủ đề nào bạn muốn (ví dụ: "Lịch sử Việt Nam", "Phim Marvel", "Khoa học vũ trụ"). AI sẽ tạo câu hỏi dựa trên chủ đề này.</li>
                    <li><strong className="text-white">Mức độ:</strong> Chọn Dễ, Vừa, hoặc Khó để điều chỉnh độ thử thách của câu hỏi.</li>
                    <li><strong className="text-white">Số câu hỏi & Thời gian:</strong> Thiết lập số lượng câu hỏi và thời gian trả lời cho mỗi câu.</li>
                    <li><strong className="text-white">Âm thanh tùy chỉnh (Tùy chọn):</strong> Tải lên các tệp âm thanh của riêng bạn cho câu trả lời đúng/sai và nhạc nền để trò chơi thêm phần sống động.</li>
                </ul>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-500">Bước 2: Xem & Chỉnh Sửa</h3>
                <p>Sau khi AI tạo xong, bạn sẽ thấy danh sách các câu hỏi. Tại đây, bạn có thể đọc lại và chỉnh sửa bất kỳ câu hỏi hoặc câu trả lời nào để đảm bảo chúng hoàn hảo theo ý bạn.</p>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-500">Bước 3: Chọn Người Chơi</h3>
                <p>Nhập tên của tất cả những người tham gia, mỗi tên một dòng. Nhấn nút "Chọn ngẫu nhiên" để vòng quay may mắn quyết định ai sẽ là người chơi tiếp theo!</p>
            </div>
            
            <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-500">Bước 4: Bắt đầu Chơi!</h3>
                <p>Người chơi được chọn sẽ xuất hiện trên màn hình chính. Trả lời các câu hỏi để leo lên các nấc thang giải thưởng. Có 3 mốc quan trọng <strong className="text-yellow-400">(câu 5, 10, và 15)</strong>. Khi vượt qua, bạn chắc chắn nhận được số tiền thưởng của mốc đó.</p>
            </div>

            <div className="space-y-2">
                <h3 className="text-xl font-bold text-yellow-500">Các Quyền Trợ Giúp</h3>
                <p>Bạn có 3 quyền trợ giúp, mỗi quyền chỉ được sử dụng một lần:</p>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mt-2">
                    <div className="flex items-center gap-2"><FiftyFiftyIcon className="w-6 h-6"/> <strong className="text-white">50:50:</strong> Máy tính sẽ loại bỏ hai phương án sai.</div>
                    <div className="flex items-center gap-2"><PhoneIcon className="w-6 h-6"/> <strong className="text-white">Gọi điện thoại:</strong> "Người thân" sẽ đưa ra một gợi ý (nhưng không phải lúc nào cũng đúng!).</div>
                    <div className="flex items-center gap-2"><AudienceIcon className="w-6 h-6"/> <strong className="text-white">Hỏi khán giả:</strong> Xem biểu đồ phần trăm lựa chọn của khán giả trong trường quay.</div>
                </div>
            </div>
        </div>

        <div className="text-center mt-6 flex-shrink-0">
          <button
            onClick={handleClose}
            className="bg-yellow-500 text-black font-bold py-2 px-8 rounded-full hover:bg-yellow-600 transition-colors text-lg"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
