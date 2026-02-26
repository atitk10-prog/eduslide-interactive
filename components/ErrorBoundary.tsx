import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    declare props: ErrorBoundaryProps;
    state: ErrorBoundaryState = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center border border-slate-100">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-3">Đã xảy ra lỗi</h2>
                        <p className="text-slate-500 font-medium mb-6">
                            Ứng dụng gặp sự cố không mong muốn. Vui lòng tải lại trang để tiếp tục.
                        </p>
                        <details className="text-left mb-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <summary className="text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer">
                                Chi tiết lỗi
                            </summary>
                            <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-32">
                                {this.state.error?.message}
                            </pre>
                        </details>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                        >
                            TẢI LẠI TRANG
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
