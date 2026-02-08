import React, { useState, useEffect, useCallback } from 'react';
import { LucideCheckCircle2, LucideAlertTriangle, LucideInfo, LucideX } from 'lucide-react';

export interface ToastMessage {
    id: number;
    text: string;
    type: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

let toastListener: ((msg: ToastMessage) => void) | null = null;

export const toast = {
    success: (text: string, duration = 3000) => {
        toastListener?.({ id: Date.now(), text, type: 'success', duration });
    },
    error: (text: string, duration = 4000) => {
        toastListener?.({ id: Date.now(), text, type: 'error', duration });
    },
    info: (text: string, duration = 3000) => {
        toastListener?.({ id: Date.now(), text, type: 'info', duration });
    },
    warning: (text: string, duration = 3500) => {
        toastListener?.({ id: Date.now(), text, type: 'warning', duration });
    }
};

const iconMap = {
    success: <LucideCheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />,
    error: <LucideAlertTriangle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <LucideInfo className="w-5 h-5 text-blue-500 shrink-0" />,
    warning: <LucideAlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
};

const bgMap = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800'
};

const ToastContainer: React.FC = () => {
    const [messages, setMessages] = useState<ToastMessage[]>([]);

    const removeToast = useCallback((id: number) => {
        setMessages(prev => prev.filter(m => m.id !== id));
    }, []);

    useEffect(() => {
        toastListener = (msg: ToastMessage) => {
            setMessages(prev => [...prev.slice(-4), msg]); // Max 5 toasts
            setTimeout(() => removeToast(msg.id), msg.duration || 3000);
        };
        return () => { toastListener = null; };
    }, [removeToast]);

    if (messages.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
            {messages.map(msg => (
                <div
                    key={msg.id}
                    className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-xl backdrop-blur-sm font-bold text-sm max-w-sm animate-in slide-in-from-right-5 duration-300 ${bgMap[msg.type]}`}
                >
                    {iconMap[msg.type]}
                    <span className="flex-1">{msg.text}</span>
                    <button onClick={() => removeToast(msg.id)} className="p-1 hover:opacity-60 transition-opacity shrink-0">
                        <LucideX className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
