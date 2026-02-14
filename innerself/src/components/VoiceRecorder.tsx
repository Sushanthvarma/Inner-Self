'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface VoiceRecorderProps {
    onTranscript: (text: string) => void;
    onRecordingChange: (isRecording: boolean) => void;
}

export default function VoiceRecorder({
    onTranscript,
    onRecordingChange,
}: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const fullTranscriptRef = useRef('');

    useEffect(() => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN'; // English with Indian accent support

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    final += result[0].transcript + ' ';
                } else {
                    interim += result[0].transcript;
                }
            }

            if (final) {
                fullTranscriptRef.current += final;
                setTranscript(fullTranscriptRef.current);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                setIsRecording(false);
                onRecordingChange(false);
            }
        };

        recognition.onend = () => {
            // Auto-restart if still recording
            if (isRecording && recognitionRef.current) {
                try {
                    recognition.start();
                } catch {
                    // Ignore errors on restart
                }
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startRecording = useCallback(() => {
        if (!recognitionRef.current) return;

        fullTranscriptRef.current = '';
        setTranscript('');
        setInterimTranscript('');
        setIsRecording(true);
        onRecordingChange(true);

        try {
            recognitionRef.current.start();
        } catch {
            // Already started
        }
    }, [onRecordingChange]);

    const stopRecording = useCallback(() => {
        if (!recognitionRef.current) return;

        setIsRecording(false);
        onRecordingChange(false);
        recognitionRef.current.stop();

        const finalText = fullTranscriptRef.current.trim();
        if (finalText) {
            onTranscript(finalText);
        }
    }, [onRecordingChange, onTranscript]);

    if (!isSupported) {
        return (
            <div className="voice-unsupported">
                <p>Voice input is not supported in this browser.</p>
                <p>Please use Chrome, Edge, or Safari.</p>
            </div>
        );
    }

    return (
        <div className="voice-recorder">
            <button
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
                <div className="mic-icon">
                    {isRecording ? (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                    ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                    )}
                </div>
                {isRecording && <div className="pulse-ring" />}
                {isRecording && <div className="pulse-ring delay" />}
            </button>

            {isRecording && (
                <div className="recording-indicator">
                    <span className="recording-dot" />
                    <span>Listening...</span>
                </div>
            )}

            {(transcript || interimTranscript) && (
                <div className="transcript-preview">
                    <span className="final-text">{transcript}</span>
                    <span className="interim-text">{interimTranscript}</span>
                </div>
            )}
        </div>
    );
}
