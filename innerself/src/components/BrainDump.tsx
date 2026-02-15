'use client';

import { useState, useRef, useEffect } from 'react';
import VoiceRecorder from './VoiceRecorder';
import DeepeningQuestionCard from './DeepeningQuestionCard';

interface BrainDumpProps {
    onProcessingComplete: (result: ProcessResult) => void;
}

interface ProcessResult {
    entryId: string;
    title: string;
    category: string;
    mood_score: number;
    ai_response: string;
    ai_persona: string;
    follow_up_question: string | null;
    is_task: boolean;
    surface_emotion: string;
    deeper_emotion: string;
}

export default function BrainDump({ onProcessingComplete }: BrainDumpProps) {
    const [text, setText] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [lastResult, setLastResult] = useState<ProcessResult | null>(null);
    const [mode, setMode] = useState<'idle' | 'typing' | 'voice'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const audioBlobRef = useRef<Blob | null>(null);

    const handleTranscript = (transcript: string) => {
        setText(transcript);
        setMode('typing'); // Switch to edit mode after voice
    };

    const handleAudioBlob = (blob: Blob) => {
        audioBlobRef.current = blob;
        console.log(`[BrainDump] Audio blob received: ${(blob.size / 1024).toFixed(1)}KB`);
    };

    const handleSubmit = async () => {
        if (!text.trim() || isProcessing) return;

        setIsProcessing(true);
        setErrorMessage('');
        const isVoice = mode === 'voice' || audioBlobRef.current !== null;

        try {
            let audioUrl: string | null = null;
            let audioDuration: number | null = null;

            // If we have an audio blob, transcribe via Whisper and save audio
            if (audioBlobRef.current) {
                setProcessingStep('Saving audio & transcribing...');
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlobRef.current, 'recording.webm');

                    const transcribeRes = await fetch('/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    const transcribeData = await transcribeRes.json();

                    if (transcribeRes.ok) {
                        audioUrl = transcribeData.audio_url;
                        audioDuration = transcribeData.audio_duration_sec;

                        // Use Whisper transcript if available (more accurate for Hinglish)
                        if (transcribeData.transcript) {
                            setText(transcribeData.transcript);
                        }
                        console.log(`[BrainDump] Whisper transcript: "${transcribeData.transcript?.substring(0, 60)}..."`);
                    } else {
                        console.warn('[BrainDump] Transcribe failed, using browser transcript:', transcribeData.error);
                    }
                } catch (err) {
                    console.warn('[BrainDump] Transcribe API unavailable, using browser transcript:', err);
                }
            }

            // Process the entry through the extraction pipeline
            setProcessingStep('Analyzing emotions & patterns...');
            const processText = text.trim();
            const response = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: processText,
                    source: isVoice ? 'voice' : 'text',
                    audio_url: audioUrl,
                    audio_duration_sec: audioDuration,
                }),
            });

            const result = await response.json();

            if (result.success !== false) {
                setLastResult(result);
                onProcessingComplete(result);
                setText('');
                setMode('idle');
                audioBlobRef.current = null;

                // Fire-and-forget background processing (Deep Analysis)
                // This triggers Life Event, Health, and Insight extraction
                fetch('/api/process/background', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entryId: result.entryId,
                        text: processText,
                    }),
                }).catch(err => console.error('[BrainDump] Background trigger failed:', err));
            }
        } catch (error) {
            console.error('Processing error:', error);
            setErrorMessage('Something went wrong while processing. Please try again.');
            setTimeout(() => setErrorMessage(''), 6000);
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    };

    useEffect(() => {
        if (textareaRef.current && mode === 'typing') {
            textareaRef.current.focus();
        }
    }, [mode]);

    return (
        <div className="brain-dump">
            {/* Header */}
            <div className="dump-header">
                <h2>Brain Dump</h2>
                <p className="dump-subtitle">Say it. Type it. Let it out.</p>
            </div>

            {/* Reflection Question */}
            <DeepeningQuestionCard />

            <div className="dump-input-area">
                {mode === 'idle' ? (
                    <div className="dump-start">
                        <VoiceRecorder
                            onTranscript={handleTranscript}
                            onAudioBlob={handleAudioBlob}
                            onRecordingChange={(recording) => {
                                setIsRecording(recording);
                                if (recording) setMode('voice');
                            }}
                        />
                        <div className="or-divider">
                            <span>or</span>
                        </div>
                        <button
                            className="type-button"
                            onClick={() => setMode('typing')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                            </svg>
                            Type instead
                        </button>
                    </div>
                ) : (
                    <div className="dump-typing">
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="What's on your mind? Let it flow..."
                            rows={6}
                            className="dump-textarea"
                            disabled={isProcessing}
                        />

                        <div className="dump-actions">
                            <button
                                className="cancel-btn"
                                onClick={() => {
                                    setText('');
                                    setMode('idle');
                                    audioBlobRef.current = null;
                                }}
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>

                            <div className="dump-actions-right">
                                <VoiceRecorder
                                    onTranscript={(t) => setText((prev) => prev + ' ' + t)}
                                    onAudioBlob={handleAudioBlob}
                                    onRecordingChange={setIsRecording}
                                />
                                <button
                                    className="submit-btn"
                                    onClick={handleSubmit}
                                    disabled={!text.trim() || isProcessing}
                                >
                                    {isProcessing ? (
                                        <span className="loading-spinner" />
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                                            </svg>
                                            Process
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {errorMessage && (
                <div className="ai-response-card" style={{ borderLeft: '3px solid var(--danger)' }}>
                    <p className="response-text" style={{ color: 'var(--danger)' }}>{errorMessage}</p>
                </div>
            )}

            {/* AI Response */}
            {lastResult && (
                <div className="ai-response-card">
                    <div className="response-persona">
                        <span className="persona-label">{lastResult.ai_persona}</span>
                        <span className="mood-badge">
                            Mood: {lastResult.mood_score}/10
                        </span>
                    </div>
                    <p className="response-text">{lastResult.ai_response}</p>
                    {lastResult.follow_up_question && (
                        <div className="follow-up">
                            <p className="follow-up-label">Something to think about:</p>
                            <p className="follow-up-text">{lastResult.follow_up_question}</p>
                        </div>
                    )}
                    <div className="response-meta">
                        <span className="category-tag">{lastResult.category}</span>
                        <span className="emotion-tag">
                            {lastResult.surface_emotion} → {lastResult.deeper_emotion}
                        </span>
                    </div>
                </div>
            )}

            {/* Processing State */}
            {isProcessing && (
                <div className="processing-overlay">
                    <div className="processing-content">
                        <div className="brain-animation">
                            <span>🧠</span>
                        </div>
                        <p>{processingStep || 'Processing your thoughts...'}</p>
                        <p className="processing-sub">
                            Analyzing emotions, patterns, and meaning
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
