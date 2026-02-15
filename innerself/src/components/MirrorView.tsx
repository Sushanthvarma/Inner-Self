'use client';

import { useState, useEffect, useRef } from 'react';

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

    // Scroll to bottom of chat
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversationHistory, isProcessing]);

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

    const handleSubmit = async (textOverride?: string) => {
        const textToSend = textOverride || answer;
        if (!textToSend.trim() || isProcessing) return;

        setIsProcessing(true);

        // Optimistically update UI
        const newHistory = [
            ...conversationHistory,
            { role: 'user' as const, content: textToSend }
        ];
        setConversationHistory(newHistory);
        setAnswer(''); // Clear input

        try {
            // First message context
            const isFirstMessage = conversationHistory.length === 0;
            const fullMessage = isFirstMessage
                ? `[Mirror asked: "${question}"]\n\nMy answer: ${textToSend}`
                : textToSend;

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: fullMessage,
                    persona: 'mirror',
                    conversationHistory: conversationHistory.slice(-6), // Keep context window
                }),
            });

            const data = await res.json();
            if (data.response) {
                setConversationHistory(prev => [
                    ...prev,
                    { role: 'assistant', content: data.response }
                ]);
            }

            // Save to DB (only the first answer usually, or all?)
            // We'll save all user inputs as they are insights
            fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `[Mirror Session]\nUser: ${textToSend}\nMirror: ${data.response}`,
                    source: 'text',
                }),
            }).catch(err => console.error('Mirror entry save failed:', err));

        } catch (error) {
            console.error('Mirror processing error:', error);
            setConversationHistory(prev => [
                ...prev,
                { role: 'assistant', content: "The mirror is clouded. I cannot see clearly right now. (Error)" }
            ]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleNewQuestion = () => {
        setAnswer('');
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
                    <div className="mirror-chat-layout">
                        {/* Scrollable Chat Area */}
                        <div className="mirror-chat-area">
                            {/* The Initial Question */}
                            <div className="mirror-question-card">
                                <div className="mirror-glow" />
                                <p className="mirror-question">{question}</p>
                            </div>

                            {/* Conversation History */}
                            {conversationHistory.map((msg, i) => (
                                <div key={i} className={`mirror-message ${msg.role}`}>
                                    {msg.role === 'assistant' && (
                                        <div className="mirror-message-label">The Mirror</div>
                                    )}
                                    <p>{msg.content}</p>
                                </div>
                            ))}

                            {isProcessing && (
                                <div className="mirror-typing-indicator">
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                    <span className="typing-dot" />
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="mirror-input-area">
                            {/* Quick Actions */}
                            {conversationHistory.length > 0 && !isProcessing && (
                                <div className="mirror-quick-actions">
                                    <button onClick={() => handleSubmit("Go deeper. What am I missing?")} className="mirror-quick-btn">
                                        🔍 Push Harder
                                    </button>
                                    <button onClick={() => handleSubmit("I don't know how to answer that.")} className="mirror-quick-btn">
                                        🤷‍♂️ I don't know
                                    </button>
                                    <button onClick={handleNewQuestion} className="mirror-quick-btn">
                                        🔄 New Topic
                                    </button>
                                </div>
                            )}

                            <div className="mirror-input-wrapper">
                                <textarea
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit();
                                        }
                                    }}
                                    placeholder={conversationHistory.length === 0 ? "Face the reflection..." : "Reply to the mirror..."}
                                    rows={1}
                                    className="mirror-textarea"
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={!answer.trim() || isProcessing}
                                    className="mirror-send-btn"
                                >
                                    {isProcessing ? (
                                        <div className="loading-spinner" />
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
