'use client';

import { useState, useEffect } from 'react';

interface MirrorMessage {
    role: 'user' | 'assistant';
    content: string;
}

export default function MirrorView() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiResponse, setAiResponse] = useState('');
    const [conversationHistory, setConversationHistory] = useState<MirrorMessage[]>([]);

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
        const userMessage = `[Mirror asked: "${question}"]\n\nMy answer: ${answer}`;

        try {
            // Route through Chat API with MIRROR persona — this gives RAG context + data-backed challenge
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    persona: 'mirror',
                    conversationHistory: conversationHistory.slice(-6),
                }),
            });

            const data = await res.json();
            if (data.response) {
                setAiResponse(data.response);
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: userMessage },
                    { role: 'assistant', content: data.response },
                ]);
            }

            // Also save the answer as a brain dump entry (fire-and-forget) so it feeds the pipeline
            fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `[Mirror Question: ${question}]\n\nMy answer: ${answer}`,
                    source: 'text',
                }),
            }).catch(err => console.error('Mirror entry save failed:', err));

        } catch (error) {
            console.error('Mirror processing error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFollowUp = async () => {
        if (!aiResponse || isProcessing) return;

        setIsProcessing(true);
        const followUp = 'Go deeper. Challenge me more. What am I still avoiding?';

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: followUp,
                    persona: 'mirror',
                    conversationHistory: conversationHistory.slice(-8),
                }),
            });

            const data = await res.json();
            if (data.response) {
                setAiResponse(data.response);
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'user', content: followUp },
                    { role: 'assistant', content: data.response },
                ]);
            }
        } catch (error) {
            console.error('Mirror follow-up error:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNewQuestion = () => {
        setAnswer('');
        setAiResponse('');
        setConversationHistory([]);
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
                                <div className="mirror-response-actions">
                                    <button
                                        className="mirror-continue"
                                        onClick={handleFollowUp}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? 'Thinking...' : 'Push harder →'}
                                    </button>
                                    <button
                                        className="mirror-continue"
                                        onClick={handleNewQuestion}
                                    >
                                        New question
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
