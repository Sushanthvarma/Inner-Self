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
                    <div className="flex flex-col h-full max-h-[70vh]">
                        {/* Scrollable Chat Area */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar">
                            {/* The Initial Question */}
                            <div className="mirror-question-card mb-8">
                                <div className="mirror-glow" />
                                <p className="mirror-question text-center text-xl font-medium leading-relaxed">{question}</p>
                            </div>

                            {/* Conversation History */}
                            {conversationHistory.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-5 py-4 ${msg.role === 'user'
                                            ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-sm'
                                            : 'bg-gray-800/50 border border-gray-700/50 text-gray-200 rounded-tl-sm'
                                            }`}
                                    >
                                        {msg.role === 'assistant' && (
                                            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-bold">The Mirror</div>
                                        )}
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {isProcessing && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-800/30 rounded-2xl px-5 py-4 flex gap-2 items-center">
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75" />
                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150" />
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="mt-4 border-t border-gray-800 pt-4 bg-[#0A0A0F] z-10">
                            {/* Quick Actions */}
                            {conversationHistory.length > 0 && !isProcessing && (
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                                    <button
                                        onClick={() => handleSubmit("Go deeper. What am I missing?")}
                                        className="whitespace-nowrap px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                    >
                                        🔍 Push Harder
                                    </button>
                                    <button
                                        onClick={() => handleSubmit("I don't know how to answer that.")}
                                        className="whitespace-nowrap px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                    >
                                        🤷‍♂️ I don't know
                                    </button>
                                    <button
                                        onClick={handleNewQuestion}
                                        className="whitespace-nowrap px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700 text-xs text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                                    >
                                        🔄 New Topic
                                    </button>
                                </div>
                            )}

                            <div className="relative">
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
                                    className="w-full bg-[#16161F] text-gray-100 border border-gray-700 rounded-xl px-4 py-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none overflow-hidden min-h-[56px] max-h-[150px] placeholder-gray-500 appearance-none"
                                    style={{ height: 'auto', minHeight: '56px', backgroundColor: '#16161F', color: '#E8E8ED' }}
                                    disabled={isProcessing}
                                />
                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={!answer.trim() || isProcessing}
                                    className="absolute right-2 bottom-2 p-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                                >
                                    {isProcessing ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
