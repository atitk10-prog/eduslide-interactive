import React, { useState, useEffect, useRef } from 'react';
import { LucideUpload, LucideTrash2, LucideSearch, LucideUsers, LucideX, LucideDownload, LucideAlertTriangle, LucideCheck, LucideLoader2, LucideFileWarning } from 'lucide-react';
import { dataService } from '../services/dataService';
import { toast } from './Toast';
import * as XLSX from 'xlsx';

interface Student {
    id: string;
    student_code: string;
    full_name: string;
    class_name: string;
}

interface RowError {
    row: number;
    student_code: string;
    full_name: string;
    class_name: string;
    reason: string;
}

interface UploadResult {
    total: number;
    success: number;
    errors: RowError[];
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
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
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

    const validateRow = (row: any[], rowIndex: number): { valid: boolean; parsed: { student_code: string; full_name: string; class_name: string } | null; error: RowError | null } => {
        const code = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const cls = String(row[2] || '').trim();

        if (!code && !name && !cls) {
            return { valid: false, parsed: null, error: null }; // Empty row, skip silently
        }

        const reasons: string[] = [];
        if (!code) reasons.push('Thiếu mã HS');
        if (!name) reasons.push('Thiếu họ tên');
        if (!cls) reasons.push('Thiếu lớp');
        if (code && code.length < 2) reasons.push('Mã HS quá ngắn (< 2 ký tự)');
        if (code && /[^a-zA-Z0-9_\-]/.test(code)) reasons.push('Mã HS chứa ký tự đặc biệt');

        if (reasons.length > 0) {
            return {
                valid: false,
                parsed: null,
                error: { row: rowIndex + 1, student_code: code, full_name: name, class_name: cls, reason: reasons.join(', ') }
            };
        }

        return { valid: true, parsed: { student_code: code, full_name: name, class_name: cls }, error: null };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        setUploadResult(null);

        try {
            // Step 1: Read file (10%)
            setUploadProgress(10);
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Step 2: Validate rows (10% → 50%)
            setUploadProgress(20);
            const validStudents: { student_code: string; full_name: string; class_name: string }[] = [];
            const errors: RowError[] = [];
            const duplicateCodes = new Set<string>();

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const result = validateRow(row, i);
                if (result.error) {
                    errors.push(result.error);
                } else if (result.parsed) {
                    // Check duplicates within file
                    if (duplicateCodes.has(result.parsed.student_code.toLowerCase())) {
                        errors.push({
                            row: i + 1,
                            student_code: result.parsed.student_code,
                            full_name: result.parsed.full_name,
                            class_name: result.parsed.class_name,
                            reason: 'Mã HS trùng lặp trong file'
                        });
                    } else {
                        duplicateCodes.add(result.parsed.student_code.toLowerCase());
                        validStudents.push(result.parsed);
                    }
                }
                setUploadProgress(20 + Math.round((i / rows.length) * 30));
            }

            // Step 3: Upload valid students in batches (50% → 90%)
            setUploadProgress(50);
            let successCount = 0;

            if (validStudents.length > 0) {
                const BATCH_SIZE = 50;
                for (let i = 0; i < validStudents.length; i += BATCH_SIZE) {
                    const batch = validStudents.slice(i, i + BATCH_SIZE);
                    const count = await dataService.createStudents(teacherId, batch);
                    successCount += count;
                    setUploadProgress(50 + Math.round(((i + batch.length) / validStudents.length) * 40));
                }
            }

            // Step 4: Done (100%)
            setUploadProgress(100);
            const result: UploadResult = {
                total: rows.length - 1,
                success: successCount,
                errors
            };
            setUploadResult(result);

            if (successCount > 0) {
                loadStudents();
            }

            if (errors.length === 0) {
                toast.success(`Tải lên thành công ${successCount} học sinh!`);
            } else if (successCount > 0) {
                toast.warning(`${successCount} thành công, ${errors.length} lỗi`);
            } else {
                toast.error(`Không có học sinh nào hợp lệ. ${errors.length} lỗi.`);
            }

        } catch (err) {
            console.error(err);
            toast.error('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const exportErrors = () => {
        if (!uploadResult?.errors.length) return;
        const wsData = [
            ['Dòng', 'Mã HS', 'Họ tên', 'Lớp', 'Lỗi'],
            ...uploadResult.errors.map(e => [e.row, e.student_code, e.full_name, e.class_name, e.reason])
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 40 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Loi');
        XLSX.writeFile(wb, 'HS_loi_can_sua.xlsx');
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
                            {uploading ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucideUpload className="w-4 h-4" />}
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

                    {/* Upload Progress */}
                    {uploading && (
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-indigo-600">
                                <span>{uploadProgress < 20 ? 'Đọc file...' : uploadProgress < 50 ? 'Kiểm tra dữ liệu...' : uploadProgress < 90 ? 'Đang lưu...' : 'Hoàn tất!'}</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Upload Result Summary */}
                    {uploadResult && !uploading && (
                        <div className={`rounded-xl p-3 border ${uploadResult.errors.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {uploadResult.errors.length > 0 ? (
                                        <LucideFileWarning className="w-5 h-5 text-amber-600" />
                                    ) : (
                                        <LucideCheck className="w-5 h-5 text-green-600" />
                                    )}
                                    <span className="font-bold text-sm text-slate-800">Kết quả tải lên</span>
                                </div>
                                <button onClick={() => setUploadResult(null)} className="text-slate-400 hover:text-slate-600">
                                    <LucideX className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex gap-4 text-xs font-bold mb-2">
                                <span className="text-slate-500">Tổng: {uploadResult.total}</span>
                                <span className="text-green-600">✓ Thành công: {uploadResult.success}</span>
                                {uploadResult.errors.length > 0 && (
                                    <span className="text-red-600">✗ Lỗi: {uploadResult.errors.length}</span>
                                )}
                            </div>

                            {/* Error Details */}
                            {uploadResult.errors.length > 0 && (
                                <>
                                    <div className="max-h-32 overflow-y-auto bg-white rounded-lg border border-amber-200">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-amber-100/50 text-left text-amber-800">
                                                    <th className="px-2 py-1 font-bold">Dòng</th>
                                                    <th className="px-2 py-1 font-bold">Mã HS</th>
                                                    <th className="px-2 py-1 font-bold">Họ tên</th>
                                                    <th className="px-2 py-1 font-bold">Lỗi</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {uploadResult.errors.map((err, i) => (
                                                    <tr key={i} className="border-t border-amber-100">
                                                        <td className="px-2 py-1 text-amber-700 font-mono">{err.row}</td>
                                                        <td className="px-2 py-1 font-mono">{err.student_code || '—'}</td>
                                                        <td className="px-2 py-1">{err.full_name || '—'}</td>
                                                        <td className="px-2 py-1 text-red-600">{err.reason}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button onClick={exportErrors}
                                        className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-all">
                                        <LucideDownload className="w-3.5 h-3.5" /> Xuất danh sách lỗi (.xlsx)
                                    </button>
                                </>
                            )}
                        </div>
                    )}

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
