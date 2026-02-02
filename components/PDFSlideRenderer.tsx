import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { LucideLoader2, LucideAlertTriangle } from 'lucide-react';

// Configure worker locally
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface PDFSlideRendererProps {
    url: string;
    pageNumber: number;
    width?: number;
    height?: number;
}

const PDFSlideRenderer: React.FC<PDFSlideRendererProps> = ({ url, pageNumber, width, height }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const onDocumentLoadSuccess = () => {
        setLoading(false);
    };

    const onDocumentLoadError = (err: any) => {
        console.error("PDF Load Error:", err);
        setError(err);
        setLoading(false);
    };

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-transparent">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <LucideLoader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            )}

            {error && (
                <div className="flex flex-col items-center gap-2 text-red-500">
                    <LucideAlertTriangle className="w-8 h-8" />
                    <span className="text-xs font-bold">Lỗi tải PDF</span>
                </div>
            )}

            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                className="flex items-center justify-center"
            >
                <Page
                    pageNumber={pageNumber}
                    width={width}
                    height={height}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="shadow-2xl"
                />
            </Document>

            {/* Cover for interactions if needed, or transparent layer */}
        </div>
    );
};

export default PDFSlideRenderer;
