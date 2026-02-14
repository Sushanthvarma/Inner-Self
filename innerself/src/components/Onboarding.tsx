'use client';

import { useState } from 'react';
import VoiceRecorder from './VoiceRecorder';
import { ONBOARDING_QUESTIONS } from '@/lib/personas';

interface OnboardingProps {
    onComplete: () => void;
    onSkip: () => void;
    startFromQuestion?: number;
    previousAnswers?: { question: string; answer: string }[];
}

export default function Onboarding({ onComplete, onSkip, startFromQuestion = 0, previousAnswers = [] }: OnboardingProps) {
    const [currentQuestion, setCurrentQuestion] = useState(startFromQuestion);
    const [answers, setAnswers] = useState<
        { question: string; answer: string }[]
    >(previousAnswers);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [phase, setPhase] = useState<'welcome' | 'questions' | 'processing'>(
        startFromQuestion > 0 ? 'questions' : 'welcome'
    );

    const phaseNames = ['Foundation', 'Foundation', 'Foundation', 'Foundation', 'Foundation',
        'Your People', 'Your People', 'Your People', 'Your People',
        'Inner World', 'Inner World', 'Inner World', 'Inner World', 'Inner World'];

    const handleNext = () => {
        if (!currentAnswer.trim()) return;

        const newAnswers = [
            ...answers,
            {
                question: ONBOARDING_QUESTIONS[currentQuestion],
                answer: currentAnswer.trim(),
            },
        ];
        setAnswers(newAnswers);
        setCurrentAnswer('');

        if (currentQuestion < ONBOARDING_QUESTIONS.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            // All questions answered
            submitOnboarding(newAnswers);
        }
    };

    const handleTranscript = (transcript: string) => {
        setCurrentAnswer((prev) => (prev ? prev + ' ' + transcript : transcript));
    };

    const handleSkip = async () => {
        // Save partial answers if any, then skip
        try {
            await fetch('/api/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers }),
            });
        } catch (error) {
            console.error('Skip error:', error);
        }
        onSkip();
    };

    const submitOnboarding = async (
        allAnswers: { question: string; answer: string }[]
    ) => {
        setPhase('processing');
        setIsProcessing(true);

        try {
            const res = await fetch('/api/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: allAnswers }),
            });

            const data = await res.json();
            if (data.success) {
                onComplete();
            }
        } catch (error) {
            console.error('Onboarding error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    if (phase === 'welcome') {
        return (
            <div className="onboarding">
                <div className="onboarding-welcome">
                    <div className="welcome-glow" />
                    <h1 className="welcome-title">Inner Self</h1>
                    <p className="welcome-tagline">Your Digital Witness</p>
                    <div className="welcome-description">
                        <p>
                            I&apos;m here to listen. To understand. To remember what matters to
                            you — so you never lose sight of who you are.
                        </p>
                        <p>
                            Let&apos;s start with a conversation. 14 questions. Take your time.
                            Speak or type — whatever feels natural.
                        </p>
                    </div>
                    <button
                        className="welcome-start"
                        onClick={() => setPhase('questions')}
                    >
                        Let&apos;s begin
                    </button>
                    <button
                        className="skip-button"
                        onClick={handleSkip}
                    >
                        Skip for now →
                    </button>
                </div>
            </div>
        );
    }

    if (phase === 'processing') {
        return (
            <div className="onboarding">
                <div className="onboarding-processing">
                    <div className="brain-animation">
                        <span>🧠</span>
                    </div>
                    <h2>Building your profile...</h2>
                    <p>
                        I&apos;m processing everything you shared. Creating your persona map,
                        identifying the people in your life, and understanding where you
                        are right now.
                    </p>
                    <p className="processing-note">This takes about 30 seconds...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="onboarding">
            <div className="onboarding-progress">
                <div
                    className="progress-fill"
                    style={{
                        width: `${((currentQuestion + 1) / ONBOARDING_QUESTIONS.length) * 100}%`,
                    }}
                />
            </div>

            <div className="onboarding-phase">
                <span className="phase-name">{phaseNames[currentQuestion]}</span>
                <span className="question-count">
                    {currentQuestion + 1} / {ONBOARDING_QUESTIONS.length}
                </span>
            </div>

            <div className="onboarding-question">
                <p className="question-text">
                    {ONBOARDING_QUESTIONS[currentQuestion]}
                </p>
            </div>

            <div className="onboarding-answer">
                <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Share as much or as little as you want..."
                    rows={5}
                    className="onboarding-textarea"
                    autoFocus
                />

                <div className="onboarding-actions">
                    <VoiceRecorder
                        onTranscript={handleTranscript}
                        onRecordingChange={() => { }}
                    />
                    <button
                        className="onboarding-next"
                        onClick={handleNext}
                        disabled={!currentAnswer.trim()}
                    >
                        {currentQuestion < ONBOARDING_QUESTIONS.length - 1
                            ? 'Next →'
                            : 'Complete ✓'}
                    </button>
                </div>

                <button
                    className="skip-button"
                    onClick={handleSkip}
                >
                    Skip remaining →
                </button>
            </div>

            {/* Previous answers preview */}
            {answers.length > 0 && (
                <div className="onboarding-history">
                    <button
                        className="history-toggle"
                        onClick={() => {
                            const el = document.querySelector('.history-list');
                            el?.classList.toggle('visible');
                        }}
                    >
                        View previous answers ({answers.length})
                    </button>
                    <div className="history-list">
                        {answers.map((a, i) => (
                            <div key={i} className="history-item">
                                <span className="history-q">Q{i + 1}:</span> {a.answer.substring(0, 100)}
                                {a.answer.length > 100 ? '...' : ''}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
