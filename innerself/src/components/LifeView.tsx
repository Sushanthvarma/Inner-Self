'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface LifeEventItem {
    id: string;
    event_date: string;
    title: string;
    description: string;
    significance: number;
    chapter: string;
    category: string;
    emotions: string[];
    people_involved: string[];
}

interface PersonItem {
    id: string;
    name: string;
    relationship: string;
    mention_count: number;
    sentiment_avg: number;
    tags: string[];
    last_mentioned: string;
}

interface BiographyData {
    biography: string | null;
    generated_at: string | null;
    cached: boolean;
}

interface GapQuestion {
    id: string;
    question_text: string;
    category: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    career: '#3B82F6',
    family: '#EC4899',
    health: '#10B981',
    relationship: '#F43F5E',
    personal: '#8B5CF6',
    loss: '#6B7280',
    achievement: '#F59E0B',
};

import HealthDashboard from './HealthDashboard';

export default function LifeView() {
    const [activeTab, setActiveTab] = useState<'events' | 'people' | 'story' | 'health'>('events');
    const [events, setEvents] = useState<LifeEventItem[]>([]);
    const [people, setPeople] = useState<PersonItem[]>([]);
    const [biography, setBiography] = useState<BiographyData | null>(null);
    const [gaps, setGaps] = useState<GapQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [analyzingGaps, setAnalyzingGaps] = useState(false);
    const [answeringGapId, setAnsweringGapId] = useState<string | null>(null);
    const [gapAnswer, setGapAnswer] = useState('');

    // Track if biography has been fetched (only story needs caching since it's expensive)
    const biographyFetched = useRef(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'events') {
                // Always re-fetch events — new data can come in from brain dumps and chat
                const res = await fetch('/api/entries?type=life');
                const data = await res.json();
                setEvents(data.events || []);
            } else if (activeTab === 'people') {
                // Always re-fetch people — new mentions can come from any entry
                const res = await fetch('/api/entries?type=people');
                const data = await res.json();
                setPeople(data.people || []);
            } else if (activeTab === 'story') {
                // Only fetch biography from API if we don't already have one in state
                if (!biography?.biography && !biographyFetched.current) {
                    const res = await fetch('/api/biography');
                    const data = await res.json();
                    if (data.biography || !biography) {
                        setBiography(data);
                    }
                    biographyFetched.current = true;
                }
            }
            // Health tab: HealthDashboard handles its own fetching
        } catch (error) {
            console.error('Failed to fetch life data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, biography]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerateBiography = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/biography', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                console.error('Biography error:', data.error);
                return;
            }
            // Immediately update state with the generated biography
            setBiography(data);
            // Allow re-fetch from API next time story tab is visited
            biographyFetched.current = false;
        } catch (error) {
            console.error('Failed to generate biography:', error);
        } finally {
            setGenerating(false);
        }
    };

    const handleAnalyzeGaps = async () => {
        setAnalyzingGaps(true);
        try {
            const res = await fetch('/api/analyze-gaps', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // Refresh to get new questions
                const gapsRes = await fetch('/api/questions?category=biography_gap');
                const gapsData = await gapsRes.json();
                setGaps(gapsData.questions || []);

                // Scroll to gaps section
                setTimeout(() => {
                    document.querySelector('.gaps-list')?.scrollIntoView({ behavior: 'smooth' });
                }, 500);
            }
        } catch (error) {
            console.error('Gap analysis error:', error);
        } finally {
            setAnalyzingGaps(false);
        }
    };

    const handleExport = async () => {
        if (!biography?.biography) return;

        const element = document.querySelector('.biography-container') as HTMLElement;
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                backgroundColor: '#16161F', // Dark mode background
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height] // Match canvas size
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`InnerSelf_Biography_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export PDF');
        }
    };

    const getSentimentColor = (avg: number) => {
        if (avg >= 7) return '#10B981';
        if (avg >= 4) return '#FBBF24';
        return '#EF4444';
    };

    const renderBiography = (text: string) => {
        // Split by ## chapter titles
        const sections = text.split(/^## /gm).filter(Boolean);

        if (sections.length <= 1) {
            // No chapters found, render as single block
            return (
                <div className="biography-chapter">
                    <div className="chapter-content">
                        {text.split('\n\n').map((para, i) => (
                            <p key={i}>{para}</p>
                        ))}
                    </div>
                </div>
            );
        }

        return sections.map((section, i) => {
            const lines = section.split('\n');
            const title = lines[0]?.trim();
            const content = lines.slice(1).join('\n').trim();

            if (!title && !content) return null;

            return (
                <div key={i} className="biography-chapter">
                    {title && <h3 className="chapter-title">{title}</h3>}
                    <div className="chapter-content">
                        {content.split('\n\n').map((para, j) => (
                            <p key={j}>{para}</p>
                        ))}
                    </div>
                </div>
            );
        });
    };

    const handleAnswerGap = async (questionId: string) => {
        if (!gapAnswer.trim()) return;
        try {
            const res = await fetch('/api/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questionId,
                    answer: gapAnswer,
                }),
            });
            const data = await res.json();
            if (data.success) {
                // Remove the answered question from the list
                setGaps(prev => prev.filter(q => q.id !== questionId));
                setAnsweringGapId(null);
                setGapAnswer('');
                // Ideally trigger a story update or at least a toast
                alert('Response saved! Your story will update in the next cycle.');
            }
        } catch (error) {
            console.error('Failed to save answer:', error);
        }
    };

    return (
        <div className="life-view">
            <div className="life-header">
                <h2>Your Life</h2>
                <div className="life-tabs">
                    <button
                        className={`life-tab ${activeTab === 'events' ? 'active' : ''}`}
                        onClick={() => setActiveTab('events')}
                    >
                        Timeline
                    </button>
                    <button
                        className={`life-tab ${activeTab === 'people' ? 'active' : ''}`}
                        onClick={() => setActiveTab('people')}
                    >
                        People
                    </button>
                    <button
                        className={`life-tab ${activeTab === 'story' ? 'active' : ''}`}
                        onClick={() => setActiveTab('story')}
                    >
                        Story
                    </button>
                    <button
                        className={`life-tab ${activeTab === 'health' ? 'active' : ''}`}
                        onClick={() => setActiveTab('health')}
                    >
                        Health
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="life-loading">
                    <div className="loading-spinner" />
                    <p>Loading...</p>
                </div>
            ) : activeTab === 'events' ? (
                events.length === 0 ? (
                    <div className="life-empty">
                        <span className="empty-icon">🌟</span>
                        <h3>Your timeline is waiting</h3>
                        <p>Life events are automatically detected from your entries.</p>
                    </div>
                ) : (
                    <div className="events-timeline">
                        {events.map((event) => (
                            <div key={event.id} className="event-card">
                                <div
                                    className="event-significance"
                                    style={{
                                        background: CATEGORY_COLORS[event.category] || '#6B7280',
                                        height: `${event.significance * 10}%`,
                                    }}
                                />
                                <div className="event-content">
                                    <div className="event-date">
                                        {new Date(event.event_date).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </div>
                                    <h3 className="event-title">{event.title}</h3>
                                    <p className="event-description">{event.description}</p>
                                    <div className="event-meta">
                                        <span
                                            className="event-category"
                                            style={{
                                                color: CATEGORY_COLORS[event.category] || '#6B7280',
                                            }}
                                        >
                                            {event.category}
                                        </span>
                                        <span className="event-sig">
                                            {'★'.repeat(Math.ceil(event.significance / 2))}
                                        </span>
                                    </div>
                                    {event.emotions?.length > 0 && (
                                        <div className="event-emotions">
                                            {event.emotions.map((e, i) => (
                                                <span key={i} className="emotion-chip">
                                                    {e}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {event.people_involved?.length > 0 && (
                                        <div className="event-people">
                                            {event.people_involved.map((p, i) => (
                                                <span key={i} className="person-chip">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'people' ? (
                people.length === 0 ? (
                    <div className="life-empty">
                        <span className="empty-icon">👥</span>
                        <h3>Your people map is building</h3>
                        <p>People are tracked automatically from your entries.</p>
                    </div>
                ) : (
                    <div className="people-grid">
                        {people.map((person) => (
                            <div key={person.id} className="person-card">
                                <div className="person-header">
                                    <div className="person-avatar">
                                        {person.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="person-info">
                                        <h3 className="person-name">{person.name}</h3>
                                        <span className="person-relationship">
                                            {person.relationship}
                                        </span>
                                    </div>
                                    <div
                                        className="sentiment-indicator"
                                        style={{
                                            backgroundColor: getSentimentColor(
                                                person.sentiment_avg
                                            ),
                                        }}
                                    >
                                        {person.sentiment_avg?.toFixed(1)}
                                    </div>
                                </div>
                                <div className="person-stats">
                                    <span>{person.mention_count} mentions</span>
                                    <span>
                                        Last:{' '}
                                        {new Date(person.last_mentioned).toLocaleDateString(
                                            'en-IN',
                                            { day: 'numeric', month: 'short' }
                                        )}
                                    </span>
                                </div>
                                {person.tags?.length > 0 && (
                                    <div className="person-tags">
                                        {person.tags.map((tag, i) => (
                                            <span key={i} className="person-tag">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'story' ? (
                /* Story Tab */
                <div className="biography-view">
                    {biography?.biography ? (
                        <div className="biography-container">
                            <div className="biography-meta">
                                <span className="biography-date">
                                    Generated{' '}
                                    {biography.generated_at
                                        ? new Date(biography.generated_at).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })
                                        : ''}
                                </span>
                                <div className="bio-actions">
                                    <button
                                        className="action-btn"
                                        onClick={handleExport}
                                        title="Download Story"
                                    >
                                        📥 Export
                                    </button>
                                    <button
                                        className="regenerate-btn"
                                        onClick={handleGenerateBiography}
                                        disabled={generating}
                                    >
                                        {generating ? '✨ Regenerating...' : '🔄 Regenerate'}
                                    </button>
                                </div>
                            </div>

                            {/* Missing Pieces Button */}
                            <div className="gaps-detective-section">
                                <button
                                    className="analyze-gaps-btn"
                                    onClick={handleAnalyzeGaps}
                                    disabled={analyzingGaps}
                                >
                                    {analyzingGaps ? '🕵️ Analyzing...' : '🕵️ Find Missing Pieces'}
                                </button>
                                <p className="gaps-detective-desc">
                                    AI will scan your story for missing chapters and generate questions.
                                </p>
                            </div>

                            {/* Gaps List */}
                            {gaps.length > 0 && (
                                <div className="gaps-list">
                                    <h3>Missing Pieces ({gaps.length})</h3>
                                    <div className="gaps-grid">
                                        {gaps.map(gap => (
                                            <div key={gap.id} className="gap-card">
                                                <p className="gap-question">{gap.question_text}</p>
                                                {answeringGapId === gap.id ? (
                                                    <div className="gap-answer-area">
                                                        <textarea
                                                            value={gapAnswer}
                                                            onChange={(e) => setGapAnswer(e.target.value)}
                                                            placeholder="Fill in the gap..."
                                                            autoFocus
                                                        />
                                                        <div className="gap-actions">
                                                            <button
                                                                className="save-btn"
                                                                onClick={() => handleAnswerGap(gap.id)}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                className="cancel-btn"
                                                                onClick={() => {
                                                                    setAnsweringGapId(null);
                                                                    setGapAnswer('');
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="answer-gap-btn"
                                                        onClick={() => setAnsweringGapId(gap.id)}
                                                    >
                                                        ✍️ Answer
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {renderBiography(biography.biography)}
                        </div>
                    ) : (
                        <div className="biography-empty">
                            <span className="empty-icon">📖</span>
                            <h3>Your Story Awaits</h3>
                            <p>
                                Generate an AI-written biography from your entries, people, and life
                                events.
                            </p>
                            <button
                                className="generate-bio-btn"
                                onClick={handleGenerateBiography}
                                disabled={generating}
                            >
                                {generating ? '✨ Writing your story...' : '📝 Generate My Story'}
                            </button>
                        </div>
                    )}
                </div>
            ) : activeTab === 'health' ? (
                <HealthDashboard />
            ) : null}
        </div>
    );
}
