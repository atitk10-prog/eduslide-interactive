import React, { useState, useEffect, useRef } from 'react';
import { LucideUpload, LucideTrash2, LucideSearch, LucideUsers, LucideX, LucideDownload, LucideAlertTriangle } from 'lucide-react';
import { dataService } from '../services/dataService';
import { toast } from './Toast';
import * as XLSX from 'xlsx';

interface Student {
    id: string;
    student_code: string;
    full_name: string;
    class_name: string;
}

interface StudentManagerProps {
    teacherId: string;
    onClose: () => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ teacherId, onClose }) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        const data = await dataService.getStudentsByTeacher(teacherId);
        setStudents(data);
        setLoading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Skip header row, parse columns: Mã HS | Họ tên | Lớp
            const parsed: { student_code: string; full_name: string; class_name: string }[] = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length < 3) continue;
                const code = String(row[0] || '').trim();
                const name = String(row[1] || '').trim();
                const cls = String(row[2] || '').trim();
                if (code && name && cls) {
                    parsed.push({ student_code: code, full_name: name, class_name: cls });
                }
            }

            if (parsed.length === 0) {
                toast.error('File không có dữ liệu hợp lệ. Cần 3 cột: Mã HS | Họ tên | Lớp');
                setUploading(false);
                return;
            }

            const count = await dataService.createStudents(teacherId, parsed);
            if (count > 0) {
                toast.success(`Đã tải lên ${count} học sinh thành công!`);
                loadStudents();
            } else {
                toast.error('Lỗi khi lưu dữ liệu học sinh');
            }
        } catch (err) {
            console.error(err);
            toast.error('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Xóa học sinh này?')) return;
        await dataService.deleteStudent(id);
        setStudents(prev => prev.filter(s => s.id !== id));
        toast.success('Đã xóa');
    };

    const handleDeleteAll = async () => {
        await dataService.deleteStudentsByTeacher(teacherId);
        setStudents([]);
        setShowDeleteAll(false);
        toast.success('Đã xóa tất cả học sinh');
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Mã HS', 'Họ tên', 'Lớp'],
            ['HS001', 'Nguyễn Văn A', '9A1'],
            ['HS002', 'Trần Thị B', '9A1'],
            ['HS003', 'Lê Văn C', '9A2'],
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh sach HS');
        XLSX.writeFile(wb, 'Mau_danh_sach_HS.xlsx');
    };

    // Get unique class names for filter
    const classNames = [...new Set(students.map(s => s.class_name))].sort();

    const filtered = students.filter(s => {
        const matchSearch = !searchQuery ||
            s.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.full_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchClass = !filterClass || s.class_name === filterClass;
        return matchSearch && matchClass;
    });

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <LucideUsers className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Quản lý Học sinh</h2>
                            <p className="text-sm text-slate-500">{students.length} học sinh</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <LucideX className="w-5 h-5" />
                    </button>
                </div>

                {/* Actions Bar */}
                <div className="p-4 border-b space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all text-sm">
                            <LucideUpload className="w-4 h-4" />
                            {uploading ? 'Đang tải...' : 'Tải lên Excel'}
                        </button>
                        <button onClick={downloadTemplate}
                            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-semibold hover:bg-slate-200 transition-all text-sm">
                            <LucideDownload className="w-4 h-4" />
                            Tải mẫu Excel
                        </button>
                        {students.length > 0 && (
                            <button onClick={() => setShowDeleteAll(true)}
                                className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-semibold hover:bg-red-100 transition-all text-sm ml-auto">
                                <LucideTrash2 className="w-4 h-4" />
                                Xóa tất cả
                            </button>
                        )}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />

                    {/* Search + Filter */}
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                                placeholder="Tìm theo mã hoặc tên..." />
                        </div>
                        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
                            className="border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200">
                            <option value="">Tất cả lớp</option>
                            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Student List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : students.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <LucideUsers className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-semibold">Chưa có học sinh</p>
                            <p className="text-sm mt-1">Tải lên file Excel (Mã HS, Họ tên, Lớp) để bắt đầu</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <p className="text-center py-8 text-slate-400">Không tìm thấy kết quả</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b">
                                    <th className="pb-2 font-semibold">#</th>
                                    <th className="pb-2 font-semibold">Mã HS</th>
                                    <th className="pb-2 font-semibold">Họ tên</th>
                                    <th className="pb-2 font-semibold">Lớp</th>
                                    <th className="pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s, i) => (
                                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 text-slate-400">{i + 1}</td>
                                        <td className="py-2.5 font-mono font-bold text-indigo-600">{s.student_code}</td>
                                        <td className="py-2.5 font-medium">{s.full_name}</td>
                                        <td className="py-2.5">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-semibold">{s.class_name}</span>
                                        </td>
                                        <td className="py-2.5 text-right">
                                            <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600 p-1 rounded transition-colors">
                                                <LucideTrash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Delete all confirm dialog */}
                {showDeleteAll && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                        <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm mx-4 text-center">
                            <LucideAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <h3 className="font-bold text-lg mb-2">Xóa tất cả học sinh?</h3>
                            <p className="text-slate-500 text-sm mb-4">Hành động này không thể hoàn tác. Toàn bộ {students.length} học sinh sẽ bị xóa.</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setShowDeleteAll(false)} className="px-4 py-2 rounded-xl border font-semibold hover:bg-slate-50">Hủy</button>
                                <button onClick={handleDeleteAll} className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700">Xóa tất cả</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentManager;
