'use client';

import { useState, useRef, useEffect } from 'react';
import { PERSONAS, PERSONA_LIST } from '@/lib/personas';
import type { AIPersona } from '@/types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    persona?: string;
}

export default function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [selectedPersona, setSelectedPersona] = useState<AIPersona>('friend');
    const [isLoading, setIsLoading] = useState(false);
    const [showPersonaSelect, setShowPersonaSelect] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load recent chat history from DB on mount
    useEffect(() => {
        if (historyLoaded) return;
        const loadHistory = async () => {
            try {
                const res = await fetch('/api/entries?type=system_activity');
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                const chatMessages = (data.activity || [])
                    .filter((a: { type: string }) => a.type === 'chat')
                    .reverse() // oldest first — API returns newest first
                    .slice(-20) // keep last 20 messages
                    .map((a: { role: string; content: string; persona?: string }) => ({
                        role: a.role as 'user' | 'assistant',
                        content: a.content,
                        persona: a.persona || selectedPersona,
                    }));
                if (chatMessages.length > 0) {
                    setMessages(chatMessages);
                    // Set persona to match the last message's persona
                    const lastPersona = chatMessages[chatMessages.length - 1]?.persona;
                    if (lastPersona) setSelectedPersona(lastPersona);
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            } finally {
                setHistoryLoaded(true);
            }
        };
        loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    persona: selectedPersona,
                    conversationHistory: messages.slice(-10).map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            const data = await res.json();
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: data.response,
                    persona: selectedPersona,
                },
            ]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: "I'm having trouble connecting right now. Try again in a moment.",
                    persona: selectedPersona,
                },
            ]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const currentPersona = PERSONAS[selectedPersona];

    return (
        <div className="chat-view">
            <div className="chat-header">
                <h2>Chat</h2>
                <button
                    className="persona-selector-btn"
                    onClick={() => setShowPersonaSelect(!showPersonaSelect)}
                    style={{ borderColor: currentPersona.color }}
                >
                    <span>{currentPersona.emoji}</span>
                    <span>{currentPersona.name}</span>
                </button>
            </div>

            {/* Persona Selector Modal */}
            {showPersonaSelect && (
                <div className="persona-modal-overlay" onClick={() => setShowPersonaSelect(false)}>
                    <div className="persona-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Choose your companion</h3>
                        <div className="persona-grid">
                            {PERSONA_LIST.map((p) => (
                                <button
                                    key={p.id}
                                    className={`persona-option ${selectedPersona === p.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        if (p.id !== selectedPersona) {
                                            setMessages([]); // Clear messages on persona switch
                                        }
                                        setSelectedPersona(p.id);
                                        setShowPersonaSelect(false);
                                    }}
                                    style={{
                                        borderColor:
                                            selectedPersona === p.id ? p.color : 'transparent',
                                    }}
                                >
                                    <span className="persona-emoji">{p.emoji}</span>
                                    <span className="persona-name">{p.name}</span>
                                    <span className="persona-desc">{p.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-welcome">
                        <span className="welcome-emoji">{currentPersona.emoji}</span>
                        <h3>
                            {currentPersona.name} is here
                        </h3>
                        <p>{currentPersona.description}</p>
                        <p className="chat-hint">
                            Say anything. I&apos;m listening.
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`chat-message ${msg.role}`}
                    >
                        {msg.role === 'assistant' && (
                            <div className="message-persona">
                                {PERSONAS[msg.persona as AIPersona]?.emoji || '🤖'}
                            </div>
                        )}
                        <div className="message-bubble">
                            <p>{msg.content}</p>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="chat-message assistant">
                        <div className="message-persona">
                            {currentPersona.emoji}
                        </div>
                        <div className="message-bubble typing">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-area">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Talk to your ${currentPersona.name.toLowerCase()}...`}
                    rows={1}
                    className="chat-input"
                    disabled={isLoading}
                />
                <button
                    className="chat-send"
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
