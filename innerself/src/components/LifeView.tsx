'use client';

import { useState, useEffect } from 'react';

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

const CATEGORY_COLORS: Record<string, string> = {
    career: '#3B82F6',
    family: '#EC4899',
    health: '#10B981',
    relationship: '#F43F5E',
    personal: '#8B5CF6',
    loss: '#6B7280',
    achievement: '#F59E0B',
};

export default function LifeView() {
    const [activeTab, setActiveTab] = useState<'events' | 'people'>('events');
    const [events, setEvents] = useState<LifeEventItem[]>([]);
    const [people, setPeople] = useState<PersonItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'events') {
                const res = await fetch('/api/entries?type=life');
                const data = await res.json();
                setEvents(data.events || []);
            } else {
                const res = await fetch('/api/entries?type=people');
                const data = await res.json();
                setPeople(data.people || []);
            }
        } catch (error) {
            console.error('Failed to fetch life data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getSentimentColor = (avg: number) => {
        if (avg >= 7) return '#10B981';
        if (avg >= 4) return '#FBBF24';
        return '#EF4444';
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
            ) : people.length === 0 ? (
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
            )}
        </div>
    );
}
