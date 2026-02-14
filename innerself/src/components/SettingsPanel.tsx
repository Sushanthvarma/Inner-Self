'use client';

import { useState, useEffect, useRef } from 'react';

interface UploadedDoc {
    id: string;
    file_name: string;
    file_type: string;
    processing_status: string;
    insights_generated: { people_count: number; events_count: number; insights_count: number } | null;
    created_at: string;
}

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onResumeOnboarding: () => void;
    onboardingStatus: {
        completed: boolean;
        skipped: boolean;
        partial: boolean;
        answeredCount: number;
        totalQuestions: number;
    };
}

export default function SettingsPanel({
    isOpen,
    onClose,
    onResumeOnboarding,
    onboardingStatus,
}: SettingsPanelProps) {
    const [documents, setDocuments] = useState<UploadedDoc[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDocuments();
        }
    }, [isOpen]);

    const fetchDocuments = async () => {
        try {
            const res = await fetch('/api/upload');
            const data = await res.json();
            setDocuments(data.documents || []);
        } catch (err) {
            console.error('Failed to fetch documents:', err);
        }
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        setUploadProgress(`Uploading ${file.name}...`);

        try {
            const formData = new FormData();
            formData.append('file', file);

            setUploadProgress(`Analyzing ${file.name} with AI...`);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (data.success) {
                setUploadProgress(
                    `✅ Done! Found ${data.peopleFound} people, ${data.eventsFound} events, ${data.insightsGenerated} insights`
                );
                fetchDocuments();
                setTimeout(() => setUploadProgress(''), 4000);
            } else {
                setUploadProgress(`❌ Error: ${data.error}`);
                setTimeout(() => setUploadProgress(''), 4000);
            }
        } catch (err) {
            console.error('Upload error:', err);
            setUploadProgress('❌ Upload failed');
            setTimeout(() => setUploadProgress(''), 3000);
        } finally {
            setUploading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleUpload(file);
    };

    const getFileIcon = (fileType: string) => {
        switch (fileType) {
            case 'pdf': return '📄';
            case 'txt': return '📝';
            case 'doc': case 'docx': return '📃';
            case 'jpg': case 'jpeg': case 'png': case 'webp': return '🖼️';
            default: return '📎';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return '✅';
            case 'processing': return '⏳';
            case 'failed': return '❌';
            default: return '⏳';
        }
    };

    const showResumeOnboarding = onboardingStatus.skipped || onboardingStatus.partial ||
        (!onboardingStatus.completed && onboardingStatus.answeredCount < onboardingStatus.totalQuestions);

    if (!isOpen) return null;

    return (
        <>
            <div className="settings-overlay" onClick={onClose} />
            <div className="settings-panel">
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button className="settings-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    {/* Onboarding Section */}
                    {showResumeOnboarding && (
                        <div className="settings-section">
                            <h3>📋 Onboarding</h3>
                            <div className="settings-card">
                                <p className="settings-card-text">
                                    {onboardingStatus.answeredCount > 0
                                        ? `You answered ${onboardingStatus.answeredCount} of ${onboardingStatus.totalQuestions} questions.`
                                        : 'You haven\'t completed the initial questions yet.'}
                                </p>
                                <div className="settings-progress-bar">
                                    <div
                                        className="settings-progress-fill"
                                        style={{ width: `${(onboardingStatus.answeredCount / onboardingStatus.totalQuestions) * 100}%` }}
                                    />
                                </div>
                                <button
                                    className="settings-action-btn"
                                    onClick={() => {
                                        onClose();
                                        onResumeOnboarding();
                                    }}
                                >
                                    {onboardingStatus.answeredCount > 0 ? 'Continue Onboarding' : 'Start Onboarding'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Upload Section */}
                    <div className="settings-section">
                        <h3>📎 Upload Documents</h3>
                        <p className="settings-section-desc">
                            Upload personal documents, notes, or images. AI will analyze them and update your profile.
                        </p>

                        <div
                            className={`upload-dropzone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => !uploading && fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.webp"
                                onChange={handleFileSelect}
                                hidden
                            />
                            {uploading ? (
                                <div className="upload-status">
                                    <div className="loading-spinner" />
                                    <p>{uploadProgress}</p>
                                </div>
                            ) : (
                                <>
                                    <span className="upload-icon">📁</span>
                                    <p>Drop a file here or tap to browse</p>
                                    <span className="upload-formats">PDF, TXT, DOCX, JPG, PNG</span>
                                </>
                            )}
                        </div>

                        {uploadProgress && !uploading && (
                            <p className="upload-result">{uploadProgress}</p>
                        )}
                    </div>

                    {/* Uploaded Documents List */}
                    {documents.length > 0 && (
                        <div className="settings-section">
                            <h3>📚 Uploaded Files</h3>
                            <div className="doc-list">
                                {documents.map((doc) => (
                                    <div key={doc.id} className="doc-item">
                                        <span className="doc-icon">{getFileIcon(doc.file_type)}</span>
                                        <div className="doc-info">
                                            <span className="doc-name">{doc.file_name}</span>
                                            <span className="doc-meta">
                                                {new Date(doc.created_at).toLocaleDateString()}
                                                {doc.insights_generated && doc.processing_status === 'completed' && (
                                                    <> · {doc.insights_generated.people_count}👤 {doc.insights_generated.events_count}📅 {doc.insights_generated.insights_count}💡</>
                                                )}
                                            </span>
                                        </div>
                                        <span className="doc-status">{getStatusBadge(doc.processing_status)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
