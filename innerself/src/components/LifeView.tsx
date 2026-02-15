'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    Tooltip,
    Cell,
} from 'recharts';

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

const getSignificanceColor = (n: number): string => {
    // Gradient from blue (1) to gold (10)
    const colors: Record<number, string> = {
        1: '#3B82F6',
        2: '#3B8BDB',
        3: '#4A94C0',
        4: '#5A9DA5',
        5: '#6BA68A',
        6: '#8BAF6F',
        7: '#ABB854',
        8: '#CBC139',
        9: '#E8D01E',
        10: '#F59E0B',
    };
    return colors[Math.max(1, Math.min(10, Math.round(n)))] || '#6B7280';
};

const getSentimentLabel = (avg: number): { label: string; color: string } => {
    if (avg >= 7) return { label: 'Positive', color: '#10B981' };
    if (avg >= 4) return { label: 'Mixed', color: '#FBBF24' };
    return { label: 'Tense', color: '#EF4444' };
};

const getSentimentColor = (avg: number): string => {
    if (avg >= 7) return '#10B981';
    if (avg >= 4) return '#FBBF24';
    return '#EF4444';
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

    // Filter state for Timeline
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterPerson, setFilterPerson] = useState<string | null>(null);
    const [filterEmotion, setFilterEmotion] = useState<string | null>(null);

    // Track if biography has been fetched
    const biographyFetched = useRef(false);
    // Track if gaps have been fetched on mount
    const gapsFetched = useRef(false);

    // Editing State
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        event_date: '',
        category: '',
        significance: 5,
    });

    const handleEditClick = (event: LifeEventItem) => {
        setEditingEventId(event.id);
        setEditForm({
            title: event.title,
            description: event.description,
            event_date: event.event_date,
            category: event.category,
            significance: event.significance,
        });
    };

    const handleSaveEvent = async (id: string) => {
        try {
            const res = await fetch('/api/entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: id,
                    ...editForm,
                }),
            });

            if (res.ok) {
                setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...editForm } : e)));
                setEditingEventId(null);
            }
        } catch (error) {
            console.error('Failed to save event:', error);
            alert('Failed to save event');
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'events') {
                const res = await fetch('/api/entries?type=life');
                const data = await res.json();
                setEvents(data.events || []);
            } else if (activeTab === 'people') {
                const res = await fetch('/api/entries?type=people');
                const data = await res.json();
                setPeople(data.people || []);
            } else if (activeTab === 'story') {
                if (!biography?.biography && !biographyFetched.current) {
                    const res = await fetch('/api/biography');
                    const data = await res.json();
                    if (data.biography || !biography) {
                        setBiography(data);
                    }
                    biographyFetched.current = true;
                }
                // Load existing gap questions on mount
                if (!gapsFetched.current) {
                    try {
                        const gapsRes = await fetch('/api/questions?category=biography_gap');
                        const gapsData = await gapsRes.json();
                        if (gapsData.questions?.length) {
                            setGaps(gapsData.questions);
                        }
                    } catch (err) {
                        console.error('Failed to fetch existing gaps:', err);
                    }
                    gapsFetched.current = true;
                }
            }
        } catch (error) {
            console.error('Failed to fetch life data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, biography]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filtered events for Timeline
    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            if (filterCategory && event.category !== filterCategory) return false;
            if (filterPerson && !event.people_involved?.includes(filterPerson)) return false;
            if (filterEmotion && !event.emotions?.includes(filterEmotion)) return false;
            return true;
        });
    }, [events, filterCategory, filterPerson, filterEmotion]);

    // Scatter chart data
    const scatterData = useMemo(() => {
        return filteredEvents.map((event) => ({
            x: new Date(event.event_date).getTime(),
            y: event.significance,
            category: event.category,
            title: event.title,
            date: event.event_date,
        }));
    }, [filteredEvents]);

    // Stats for events
    const eventsStats = useMemo(() => {
        if (filteredEvents.length === 0) return null;
        const dates = filteredEvents.map((e) => new Date(e.event_date).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const categoryBreakdown: Record<string, number> = {};
        filteredEvents.forEach((e) => {
            categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
        });
        return {
            total: filteredEvents.length,
            dateRange: {
                from: minDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
                to: maxDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
            },
            categories: categoryBreakdown,
        };
    }, [filteredEvents]);

    // Max mentions for people bar
    const maxMentions = useMemo(() => {
        if (people.length === 0) return 1;
        return Math.max(...people.map((p) => p.mention_count), 1);
    }, [people]);

    const hasActiveFilters = filterCategory || filterPerson || filterEmotion;

    const clearAllFilters = () => {
        setFilterCategory(null);
        setFilterPerson(null);
        setFilterEmotion(null);
    };

    const handleGenerateBiography = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/biography', { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                console.error('Biography error:', data.error);
                return;
            }
            setBiography(data);
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
                const gapsRes = await fetch('/api/questions?category=biography_gap');
                const gapsData = await gapsRes.json();
                setGaps(gapsData.questions || []);

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
                scale: 2,
                backgroundColor: '#16161F',
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
            });

            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`InnerSelf_Biography_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export PDF');
        }
    };

    const renderBiography = (text: string) => {
        const sections = text.split(/^## /gm).filter(Boolean);

        if (sections.length <= 1) {
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
                setGaps((prev) => prev.filter((q) => q.id !== questionId));
                setAnsweringGapId(null);
                setGapAnswer('');
                alert('Response saved! Your story will update in the next cycle.');
            }
        } catch (error) {
            console.error('Failed to save answer:', error);
        }
    };

    const ScatterTooltipContent = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { title: string; date: string; y: number; category: string } }> }) => {
        if (!active || !payload?.length) return null;
        const data = payload[0].payload;
        return (
            <div className="scatter-tooltip">
                <p className="scatter-tooltip-title">{data.title}</p>
                <p className="scatter-tooltip-date">
                    {new Date(data.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    })}
                </p>
                <p className="scatter-tooltip-sig">
                    Significance: {data.y}/10
                </p>
            </div>
        );
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
                        {/* Summary Stats Bar */}
                        {eventsStats && (
                            <div className="timeline-stats-bar">
                                <span className="stats-total">
                                    {eventsStats.total} event{eventsStats.total !== 1 ? 's' : ''}
                                </span>
                                <span className="stats-date-range">
                                    {eventsStats.dateRange.from} — {eventsStats.dateRange.to}
                                </span>
                                <div className="stats-categories">
                                    {Object.entries(eventsStats.categories).map(([cat, count]) => (
                                        <span
                                            key={cat}
                                            className="stats-category-pill clickable"
                                            style={{ color: CATEGORY_COLORS[cat] || '#6B7280' }}
                                            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                                        >
                                            {cat} ({count})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Filters Bar */}
                        {hasActiveFilters && (
                            <div className="timeline-filter-bar">
                                <span className="filter-bar-label">Filters:</span>
                                {filterCategory && (
                                    <span className="filter-tag">
                                        {filterCategory}
                                        <button
                                            className="filter-tag-clear"
                                            onClick={() => setFilterCategory(null)}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                                {filterPerson && (
                                    <span className="filter-tag">
                                        {filterPerson}
                                        <button
                                            className="filter-tag-clear"
                                            onClick={() => setFilterPerson(null)}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                                {filterEmotion && (
                                    <span className="filter-tag">
                                        {filterEmotion}
                                        <button
                                            className="filter-tag-clear"
                                            onClick={() => setFilterEmotion(null)}
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                                <button className="filter-clear-all" onClick={clearAllFilters}>
                                    Clear all
                                </button>
                            </div>
                        )}

                        {/* Timeline Scatter Chart */}
                        {scatterData.length > 0 && (
                            <div className="timeline-chart">
                                <ResponsiveContainer width="100%" height={200}>
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                                        <XAxis
                                            dataKey="x"
                                            type="number"
                                            domain={['dataMin', 'dataMax']}
                                            tickFormatter={(val: number) =>
                                                new Date(val).toLocaleDateString('en-IN', {
                                                    month: 'short',
                                                    year: '2-digit',
                                                })
                                            }
                                            name="Date"
                                            stroke="var(--text-tertiary)"
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis
                                            dataKey="y"
                                            type="number"
                                            domain={[0, 10]}
                                            name="Significance"
                                            stroke="var(--text-tertiary)"
                                            tick={{ fontSize: 11 }}
                                            width={30}
                                        />
                                        <ZAxis range={[40, 120]} />
                                        <Tooltip content={<ScatterTooltipContent />} />
                                        <Scatter data={scatterData}>
                                            {scatterData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={CATEGORY_COLORS[entry.category] || '#6B7280'}
                                                />
                                            ))}
                                        </Scatter>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Event Cards */}
                        {filteredEvents.map((event) => (
                            <div key={event.id} className="event-card">
                                <div
                                    className="event-significance"
                                    style={{
                                        background: CATEGORY_COLORS[event.category] || '#6B7280',
                                        height: `${event.significance * 10}%`,
                                    }}
                                />
                                <div className="event-content">
                                    {/* Edit Modal Overlay */}
                                    {editingEventId === event.id && (
                                        <div className="edit-event-overlay">
                                            <div
                                                className="edit-event-content"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="edit-event-header">
                                                    <h3 className="edit-event-heading">Edit Event</h3>
                                                    <button
                                                        onClick={() => setEditingEventId(null)}
                                                        className="edit-event-close"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>

                                                <div className="edit-event-body">
                                                    <div className="edit-event-field">
                                                        <label className="edit-event-label">Title</label>
                                                        <input
                                                            type="text"
                                                            value={editForm.title}
                                                            onChange={(e) =>
                                                                setEditForm({ ...editForm, title: e.target.value })
                                                            }
                                                            className="edit-event-input"
                                                            placeholder="Event Title"
                                                        />
                                                    </div>

                                                    <div className="edit-event-field">
                                                        <label className="edit-event-label">Description</label>
                                                        <textarea
                                                            value={editForm.description}
                                                            onChange={(e) =>
                                                                setEditForm({
                                                                    ...editForm,
                                                                    description: e.target.value,
                                                                })
                                                            }
                                                            className="edit-event-textarea"
                                                            placeholder="What happened?"
                                                        />
                                                    </div>

                                                    <div
                                                        className="edit-event-field"
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: '16px',
                                                        }}
                                                    >
                                                        <div className="edit-event-field">
                                                            <label className="edit-event-label">Date</label>
                                                            <input
                                                                type="date"
                                                                value={editForm.event_date}
                                                                onChange={(e) =>
                                                                    setEditForm({
                                                                        ...editForm,
                                                                        event_date: e.target.value,
                                                                    })
                                                                }
                                                                className="edit-event-input"
                                                            />
                                                        </div>
                                                        <div className="edit-event-field">
                                                            <label className="edit-event-label">Category</label>
                                                            <select
                                                                value={editForm.category}
                                                                onChange={(e) =>
                                                                    setEditForm({
                                                                        ...editForm,
                                                                        category: e.target.value,
                                                                    })
                                                                }
                                                                className="edit-event-select"
                                                            >
                                                                {Object.keys(CATEGORY_COLORS).map((c) => (
                                                                    <option key={c} value={c}>
                                                                        {c.charAt(0).toUpperCase() + c.slice(1)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="edit-event-field">
                                                        <div className="edit-event-range-header">
                                                            <label className="edit-event-label">
                                                                Impact &amp; Significance
                                                            </label>
                                                            <span
                                                                className="edit-event-range-value"
                                                                style={{ color: 'var(--accent-primary)' }}
                                                            >
                                                                {editForm.significance}/10
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="1"
                                                            max="10"
                                                            value={editForm.significance}
                                                            onChange={(e) =>
                                                                setEditForm({
                                                                    ...editForm,
                                                                    significance: parseInt(e.target.value),
                                                                })
                                                            }
                                                            className="edit-event-range"
                                                        />
                                                        <div className="edit-event-range-labels">
                                                            <span>Minor</span>
                                                            <span>Major</span>
                                                            <span>Life Changing</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="edit-event-footer">
                                                    <button
                                                        onClick={() => setEditingEventId(null)}
                                                        className="edit-btn cancel"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveEvent(event.id)}
                                                        className="edit-btn save"
                                                    >
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="event-date">
                                        {new Date(event.event_date).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                        {(event as any).created_at && (
                                            <span className="event-date-logged">
                                                (Logged:{' '}
                                                {new Date(
                                                    (event as any).created_at
                                                ).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                                )
                                            </span>
                                        )}
                                    </div>
                                    <div className="event-title-row">
                                        <h3 className="event-title">{event.title}</h3>
                                        <button
                                            onClick={() => handleEditClick(event)}
                                            className="event-edit-btn"
                                            title="Edit Event"
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                    <p className="event-description">{event.description}</p>
                                    <div className="event-meta">
                                        <span
                                            className="event-category clickable"
                                            style={{
                                                color: CATEGORY_COLORS[event.category] || '#6B7280',
                                            }}
                                            onClick={() => setFilterCategory(event.category)}
                                        >
                                            {event.category}
                                        </span>
                                        <span
                                            className="sig-badge"
                                            style={{
                                                background: getSignificanceColor(event.significance),
                                            }}
                                        >
                                            {event.significance}
                                        </span>
                                    </div>
                                    {event.emotions?.length > 0 && (
                                        <div className="event-emotions">
                                            {event.emotions.map((em, i) => (
                                                <span
                                                    key={i}
                                                    className="emotion-chip clickable"
                                                    onClick={() => setFilterEmotion(em)}
                                                >
                                                    {em}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {event.people_involved?.length > 0 && (
                                        <div className="event-people">
                                            {event.people_involved.map((p, i) => (
                                                <span
                                                    key={i}
                                                    className="person-chip clickable"
                                                    onClick={() => setFilterPerson(p)}
                                                >
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
                        {people.map((person) => {
                            const sentiment = getSentimentLabel(person.sentiment_avg);
                            return (
                                <div key={person.id} className="person-card">
                                    <div className="person-header">
                                        <div
                                            className="person-avatar"
                                            style={{
                                                borderColor: getSentimentColor(person.sentiment_avg),
                                            }}
                                        >
                                            {person.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="person-info">
                                            <h3 className="person-name">{person.name}</h3>
                                            <span className="person-relationship">
                                                {person.relationship}
                                            </span>
                                            <span
                                                className="sentiment-label"
                                                style={{ color: sentiment.color }}
                                            >
                                                {sentiment.label}
                                            </span>
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
                                    <div className="mention-bar">
                                        <div
                                            className="mention-bar-fill"
                                            style={{
                                                width: `${Math.min(100, (person.mention_count / maxMentions) * 100)}%`,
                                                background: getSentimentColor(person.sentiment_avg),
                                            }}
                                        />
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
                            );
                        })}
                    </div>
                )
            ) : activeTab === 'story' ? (
                <div className="biography-view">
                    {biography?.biography ? (
                        <div className="biography-container">
                            <div className="biography-meta">
                                <span className="biography-date">
                                    Generated{' '}
                                    {biography.generated_at
                                        ? new Date(biography.generated_at).toLocaleDateString(
                                              'en-IN',
                                              {
                                                  day: 'numeric',
                                                  month: 'short',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit',
                                              }
                                          )
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

                            <div className="gaps-detective-section">
                                <button
                                    className="analyze-gaps-btn"
                                    onClick={handleAnalyzeGaps}
                                    disabled={analyzingGaps}
                                >
                                    {analyzingGaps ? '🕵️ Analyzing...' : '🕵️ Find Missing Pieces'}
                                </button>
                                <p className="gaps-detective-desc">
                                    AI will scan your story for missing chapters and generate
                                    questions.
                                </p>
                            </div>

                            {gaps.length > 0 && (
                                <div className="gaps-list">
                                    <h3>Missing Pieces ({gaps.length})</h3>
                                    <div className="gaps-grid">
                                        {gaps.map((gap) => (
                                            <div key={gap.id} className="gap-card">
                                                <p className="gap-question">{gap.question_text}</p>
                                                {answeringGapId === gap.id ? (
                                                    <div className="gap-answer-area">
                                                        <textarea
                                                            value={gapAnswer}
                                                            onChange={(e) =>
                                                                setGapAnswer(e.target.value)
                                                            }
                                                            placeholder="Fill in the gap..."
                                                            autoFocus
                                                        />
                                                        <div className="gap-actions">
                                                            <button
                                                                className="save-btn"
                                                                onClick={() =>
                                                                    handleAnswerGap(gap.id)
                                                                }
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
