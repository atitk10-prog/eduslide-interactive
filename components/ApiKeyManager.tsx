import React, { useState, useEffect } from 'react';
import { LucideKey, LucidePlus, LucideTrash2, LucideLoader2, LucideEye, LucideEyeOff, LucideRefreshCw, LucideX, LucideCheck, LucideAlertTriangle } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ApiKey {
    id: string;
    api_key: string;
    label: string;
    is_active: boolean;
    usage_count: number;
}

interface ApiKeyManagerProps {
    onClose: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onClose }) => {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [adding, setAdding] = useState(false);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [testingKey, setTestingKey] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail' | null>>({});

    const loadKeys = async () => {
        setLoading(true);
        const data = await dataService.getApiKeys();
        setKeys(data);
        setLoading(false);
    };

    useEffect(() => { loadKeys(); }, []);

    const handleAdd = async () => {
        if (!newKey.trim()) return;
        setAdding(true);
        const ok = await dataService.addApiKey(newKey.trim(), newLabel.trim() || undefined);
        if (ok) {
            setNewKey('');
            setNewLabel('');
            await loadKeys();
        }
        setAdding(false);
    };

    const handleRemove = async (id: string) => {
        if (!confirm('Xóa API key này?')) return;
        await dataService.removeApiKey(id);
        await loadKeys();
    };

    const handleTest = async (key: ApiKey) => {
        setTestingKey(key.id);
        setTestResult(prev => ({ ...prev, [key.id]: null }));
        try {
            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey: key.api_key });
            await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'Hello' });
            setTestResult(prev => ({ ...prev, [key.id]: 'ok' }));
        } catch {
            setTestResult(prev => ({ ...prev, [key.id]: 'fail' }));
        }
        setTestingKey(null);
    };

    const maskKey = (key: string) => key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.slice(-4);

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <LucideKey className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900">Quản lý API Key</h2>
                            <p className="text-xs text-slate-500">Gemini AI • Xoay vòng tự động</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><LucideX className="w-5 h-5 text-slate-400" /></button>
                </div>

                {/* Add new key */}
                <div className="p-4 bg-slate-50 border-b">
                    <div className="flex gap-2">
                        <input
                            value={newKey}
                            onChange={e => setNewKey(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-500"
                            placeholder="AIzaSy..."
                        />
                        <input
                            value={newLabel}
                            onChange={e => setNewLabel(e.target.value)}
                            className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                            placeholder="Nhãn"
                        />
                        <button
                            onClick={handleAdd}
                            disabled={!newKey.trim() || adding}
                            className="bg-indigo-600 text-white px-4 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                        >
                            {adding ? <LucideLoader2 className="w-4 h-4 animate-spin" /> : <LucidePlus className="w-4 h-4" />}
                            Thêm
                        </button>
                    </div>
                </div>

                {/* Key list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="text-center py-8 text-slate-400">
                            <LucideLoader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            Đang tải...
                        </div>
                    ) : keys.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <LucideKey className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="font-bold">Chưa có API key nào</p>
                            <p className="text-xs mt-1">Thêm key Gemini AI để tạo câu hỏi tự động</p>
                        </div>
                    ) : (
                        keys.map(key => (
                            <div key={key.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:border-indigo-300 transition-all group">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-slate-900">{key.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${key.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {key.is_active ? 'Hoạt động' : 'Tắt'}
                                        </span>
                                        {testResult[key.id] === 'ok' && <span className="text-green-500"><LucideCheck className="w-4 h-4" /></span>}
                                        {testResult[key.id] === 'fail' && <span className="text-red-500"><LucideAlertTriangle className="w-4 h-4" /></span>}
                                    </div>
                                    <p className="text-xs font-mono text-slate-400 truncate">
                                        {showKeys[key.id] ? key.api_key : maskKey(key.api_key)}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">Đã dùng: {key.usage_count} lần</p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => setShowKeys(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                                        className="p-2 hover:bg-slate-100 rounded-lg" title="Hiện/ẩn key"
                                    >
                                        {showKeys[key.id] ? <LucideEyeOff className="w-4 h-4 text-slate-400" /> : <LucideEye className="w-4 h-4 text-slate-400" />}
                                    </button>
                                    <button
                                        onClick={() => handleTest(key)}
                                        disabled={testingKey === key.id}
                                        className="p-2 hover:bg-blue-50 rounded-lg" title="Test key"
                                    >
                                        {testingKey === key.id ? <LucideLoader2 className="w-4 h-4 animate-spin text-blue-500" /> : <LucideRefreshCw className="w-4 h-4 text-blue-500" />}
                                    </button>
                                    <button
                                        onClick={() => handleRemove(key.id)}
                                        className="p-2 hover:bg-red-50 rounded-lg" title="Xóa key"
                                    >
                                        <LucideTrash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50 rounded-b-3xl">
                    <p className="text-[11px] text-slate-400 text-center">
                        Key được xoay vòng tự động — key ít dùng nhất sẽ được ưu tiên
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyManager;
