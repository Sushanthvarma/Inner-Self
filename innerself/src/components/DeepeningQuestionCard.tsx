'use client';

import React, { useState, useEffect } from 'react';

interface Question {
    id: string;
    question_text: string;
    category: string;
    week_range: string;
}

export default function DeepeningQuestionCard() {
    const [question, setQuestion] = useState<Question | null>(null);
    const [loading, setLoading] = useState(true);
    const [answer, setAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const fetchQuestion = async () => {
            try {
                const res = await fetch('/api/questions');
                const data = await res.json();
                if (data.question) {
                    setQuestion(data.question);
                }
            } catch (err) {
                console.error('Failed to fetch question:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchQuestion();
    }, []);

    const handleAnswer = async () => {
        if (!question || !answer.trim()) return;

        setSubmitting(true);
        try {
            await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: question.id,
                    answer: answer
                })
            });
            setHidden(true); // Hide card after answering
        } catch (err) {
            console.error('Failed to submit answer:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = async () => {
        if (!question) return;

        setHidden(true);
        try {
            await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId: question.id,
                    skipped: true
                })
            });
        } catch (err) {
            console.error('Failed to skip:', err);
        }
    };

    if (loading || !question || hidden) return null;

    return (
        <div className="deepening-card">
            <div className="deepening-card-inner">
                <span className="deepening-emoji">🤔</span>
                <div className="deepening-body">
                    <h3 className="deepening-label">Reflection for You</h3>
                    <p className="deepening-question">{question.question_text}</p>

                    <textarea
                        className="deepening-textarea"
                        rows={3}
                        placeholder="Type your answer..."
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                    />

                    <div className="deepening-actions">
                        <button
                            onClick={handleSkip}
                            className="deepening-skip"
                        >
                            Skip for today
                        </button>
                        <button
                            onClick={handleAnswer}
                            disabled={!answer.trim() || submitting}
                            className="deepening-save"
                        >
                            {submitting ? 'Saving...' : 'Save Answer'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
