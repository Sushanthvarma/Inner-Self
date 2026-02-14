'use client';

import { useState, useEffect } from 'react';

export default function MirrorView() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiResponse, setAiResponse] = useState('');

    useEffect(() => {
        fetchMirrorQuestion();
    }, []);

    const fetchMirrorQuestion = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/mirror');
            const data = await res.json();
            setQuestion(data.question);
        } catch (error) {
            console.error('Failed to fetch mirror question:', error);
            setQuestion("What's the one truth you've been avoiding?");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!answer.trim() || isProcessing) return;

        setIsProcessing(true);
        try {
            // Process as brain dump with mirror context
            const res = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `[Mirror Question: ${question}]\n\nMy answer: ${answer}`,
                    source: 'text',
                }),
            });

            const data = await res.json();
            if (data.ai_response) {
                setAiResponse(data.ai_response);
            }
        } catch (error) {
            console.error('Mirror processing error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNewQuestion = () => {
        setAnswer('');
        setAiResponse('');
        fetchMirrorQuestion();
    };

    return (
        <div className="mirror-view">
            <div className="mirror-header">
                <h2>The Mirror</h2>
                <p className="mirror-subtitle">
                    No flattery. No escape. Just truth.
                </p>
            </div>

            <div className="mirror-content">
                {isLoading ? (
                    <div className="mirror-loading">
                        <div className="mirror-icon">🪞</div>
                        <p>The mirror is preparing...</p>
                    </div>
                ) : (
                    <>
                        <div className="mirror-question-card">
                            <div className="mirror-glow" />
                            <p className="mirror-question">{question}</p>
                        </div>

                        <div className="mirror-answer-area">
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="Be honest with yourself..."
                                rows={5}
                                className="mirror-textarea"
                                disabled={isProcessing}
                            />

                            <div className="mirror-actions">
                                <button
                                    className="mirror-skip"
                                    onClick={handleNewQuestion}
                                    disabled={isProcessing}
                                >
                                    Different question
                                </button>
                                <button
                                    className="mirror-submit"
                                    onClick={handleSubmit}
                                    disabled={!answer.trim() || isProcessing}
                                >
                                    {isProcessing ? (
                                        <span className="loading-spinner" />
                                    ) : (
                                        'Face it'
                                    )}
                                </button>
                            </div>
                        </div>

                        {aiResponse && (
                            <div className="mirror-response">
                                <div className="mirror-response-header">
                                    <span>🪞 The Mirror speaks:</span>
                                </div>
                                <p>{aiResponse}</p>
                                <button
                                    className="mirror-continue"
                                    onClick={handleNewQuestion}
                                >
                                    Go deeper →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
