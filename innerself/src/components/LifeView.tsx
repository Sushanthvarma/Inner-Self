'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface LifeEventItem {
    id: string;
    event_date: string | null;
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

// ---- Timezone-safe date helpers ----
// Supabase returns DATE columns as "YYYY-MM-DD" strings.
// new Date("2013-01-01") parses as UTC midnight, which in IST becomes Dec 31 previous year.
// These helpers parse dates WITHOUT timezone shifts.
function parseLocalDate(dateStr: string): Date {
    // Handle "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS..." formats
    const parts = dateStr.substring(0, 10).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function formatEventDate(dateStr: string | null, options?: Intl.DateTimeFormatOptions): string {
    if (!dateStr) return 'Date unknown';
    const d = parseLocalDate(dateStr);
    if (isNaN(d.getTime())) return 'Date unknown';
    return d.toLocaleDateString('en-IN', options || { day: 'numeric', month: 'short', year: 'numeric' });
}

function getEventYear(dateStr: string): string {
    return dateStr.substring(0, 4);
}

function getEventTime(dateStr: string): number {
    return parseLocalDate(dateStr).getTime();
}

const CATEGORY_COLORS: Record<string, string> = {
    career: '#3B82F6',
    family: '#EC4899',
    health: '#10B981',
    relationship: '#F43F5E',
    personal: '#8B5CF6',
    loss: '#6B7280',
    achievement: '#F59E0B',
    education: '#06B6D4',
    finance: '#F97316',
    professional_achievement: '#EAB308',
    personal_development: '#A78BFA',
};

const getSignificanceColor = (n: number): string => {
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
import LetterToFuture from './LetterToFuture';

export default function LifeView() {
    const [activeTab, setActiveTab] = useState<'events' | 'people' | 'story' | 'health' | 'letters'>('events');
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

    // Editing State (events)
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        event_date: '',
        category: '',
        significance: 5,
    });

    // People Edit/Delete State
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [editPersonForm, setEditPersonForm] = useState({ name: '', relationship: '' });
    const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);

    const handleEditClick = (event: LifeEventItem) => {
        setEditingEventId(event.id);
        // Ensure date is in YYYY-MM-DD format for HTML date input
        let dateForInput = '';
        if (event.event_date) {
            const d = event.event_date.substring(0, 10); // handles both "2010-01-01" and "2010-01-01T00:00:00Z"
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                dateForInput = d;
            }
        }
        setEditForm({
            title: event.title,
            description: event.description,
            event_date: dateForInput,
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

    // People Edit handler
    const handleEditPerson = async (personId: string) => {
        try {
            const res = await fetch('/api/entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personId, ...editPersonForm }),
            });
            if (res.ok) {
                setPeople((prev) =>
                    prev.map((p) => (p.id === personId ? { ...p, ...editPersonForm } : p))
                );
                setEditingPersonId(null);
            }
        } catch (error) {
            console.error('Failed to edit person:', error);
        }
    };

    // People Delete handler
    const handleDeletePerson = async (personId: string) => {
        try {
            const res = await fetch('/api/entries', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personId }),
            });
            if (res.ok) {
                setPeople((prev) => prev.filter((p) => p.id !== personId));
                setDeletingPersonId(null);
            }
        } catch (error) {
            console.error('Failed to delete person:', error);
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

    // Group events by year for chronological timeline
    // Events with null/invalid dates go into an "Undated" group at the end
    const timelineByYear = useMemo(() => {
        const sorted = [...filteredEvents].sort((a, b) => {
            if (!a.event_date && !b.event_date) return 0;
            if (!a.event_date) return 1;  // nulls go last
            if (!b.event_date) return -1;
            return getEventTime(a.event_date) - getEventTime(b.event_date);
        });
        const groups: Record<string, LifeEventItem[]> = {};
        sorted.forEach((event) => {
            if (!event.event_date) {
                if (!groups['Undated']) groups['Undated'] = [];
                groups['Undated'].push(event);
            } else {
                const year = getEventYear(event.event_date);
                if (!groups[year]) groups[year] = [];
                groups[year].push(event);
            }
        });
        return Object.entries(groups).sort(([a], [b]) => {
            if (a === 'Undated') return 1;
            if (b === 'Undated') return -1;
            return Number(a) - Number(b);
        });
    }, [filteredEvents]);

    // Stats for events
    const eventsStats = useMemo(() => {
        if (filteredEvents.length === 0) return null;
        const datedEvents = filteredEvents.filter((e) => e.event_date);
        const dates = datedEvents.map((e) => getEventTime(e.event_date!));
        const minDate = dates.length > 0 ? parseLocalDate(datedEvents.reduce((a, b) => a.event_date! < b.event_date! ? a : b).event_date!) : new Date();
        const maxDate = dates.length > 0 ? parseLocalDate(datedEvents.reduce((a, b) => a.event_date! > b.event_date! ? a : b).event_date!) : new Date();
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
                    <button
                        className={`life-tab ${activeTab === 'letters' ? 'active' : ''}`}
                        onClick={() => setActiveTab('letters')}
                    >
                        Letters
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

                        {/* Chronological Timeline */}
                        <div className="chrono-timeline">
                            {timelineByYear.map(([year, yearEvents]) => (
                                <div key={year} className="chrono-year-group">
                                    <div className="chrono-year-label">{year}</div>
                                    <div className="chrono-line">
                                        {yearEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="chrono-event"
                                                style={{ borderLeftColor: CATEGORY_COLORS[event.category] || '#6B7280' }}
                                            >
                                                <div className="chrono-event-date">
                                                    {formatEventDate(event.event_date)}
                                                </div>
                                                <div className="event-title-row">
                                                    <h3 className="chrono-event-title">{event.title}</h3>
                                                    <button
                                                        onClick={() => handleEditClick(event)}
                                                        className="event-edit-btn"
                                                        title="Edit Event"
                                                    >
                                                        ✏️
                                                    </button>
                                                </div>
                                                <p className="chrono-event-desc">{event.description}</p>
                                                <div className="chrono-event-meta">
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
                                                    {event.emotions?.length > 0 &&
                                                        event.emotions.map((em, i) => (
                                                            <span
                                                                key={i}
                                                                className="emotion-chip clickable"
                                                                onClick={() => setFilterEmotion(em)}
                                                            >
                                                                {em}
                                                            </span>
                                                        ))}
                                                    {event.people_involved?.length > 0 &&
                                                        event.people_involved.map((p, i) => (
                                                            <span
                                                                key={i}
                                                                className="person-chip clickable"
                                                                onClick={() => setFilterPerson(p)}
                                                            >
                                                                {p}
                                                            </span>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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
                                    {/* Person Actions */}
                                    <div className="person-actions">
                                        <button
                                            className="person-action-btn"
                                            title="Edit"
                                            onClick={() => {
                                                setEditingPersonId(person.id);
                                                setEditPersonForm({
                                                    name: person.name,
                                                    relationship: person.relationship,
                                                });
                                                setDeletingPersonId(null);
                                            }}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="person-action-btn"
                                            title="Delete"
                                            onClick={() => {
                                                setDeletingPersonId(person.id);
                                                setEditingPersonId(null);
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>

                                    {/* Delete Confirmation */}
                                    {deletingPersonId === person.id && (
                                        <div className="person-delete-confirm">
                                            <p>Delete {person.name}?</p>
                                            <div className="person-delete-actions">
                                                <button
                                                    className="edit-btn save"
                                                    onClick={() => handleDeletePerson(person.id)}
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    className="edit-btn cancel"
                                                    onClick={() => setDeletingPersonId(null)}
                                                >
                                                    No
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inline Edit Form */}
                                    {editingPersonId === person.id ? (
                                        <div className="person-edit-form">
                                            <div className="edit-event-field">
                                                <label className="edit-event-label">Name</label>
                                                <input
                                                    type="text"
                                                    value={editPersonForm.name}
                                                    onChange={(e) =>
                                                        setEditPersonForm({ ...editPersonForm, name: e.target.value })
                                                    }
                                                    className="edit-event-input"
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div className="edit-event-field">
                                                <label className="edit-event-label">Relationship</label>
                                                <select
                                                    value={editPersonForm.relationship}
                                                    onChange={(e) =>
                                                        setEditPersonForm({
                                                            ...editPersonForm,
                                                            relationship: e.target.value,
                                                        })
                                                    }
                                                    className="edit-event-select"
                                                >
                                                    <option value="">Select relationship</option>
                                                    <option value="Wife">Wife</option>
                                                    <option value="Husband">Husband</option>
                                                    <option value="Son">Son</option>
                                                    <option value="Daughter">Daughter</option>
                                                    <option value="Father">Father</option>
                                                    <option value="Mother">Mother</option>
                                                    <option value="Brother">Brother</option>
                                                    <option value="Sister">Sister</option>
                                                    <option value="Friend">Friend</option>
                                                    <option value="School Friend">School Friend</option>
                                                    <option value="College Friend">College Friend</option>
                                                    <option value="Colleague">Colleague</option>
                                                    <option value="Manager">Manager</option>
                                                    <option value="Former Manager">Former Manager</option>
                                                    <option value="Client">Client</option>
                                                    <option value="Mentor">Mentor</option>
                                                    <option value="Doctor">Doctor</option>
                                                    <option value="Referring Doctor">Referring Doctor</option>
                                                    <option value="Therapist">Therapist</option>
                                                    <option value="Relative">Relative</option>
                                                    <option value="Neighbor">Neighbor</option>
                                                    <option value="Acquaintance">Acquaintance</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div className="person-edit-actions">
                                                <button
                                                    className="edit-btn save"
                                                    onClick={() => handleEditPerson(person.id)}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="edit-btn cancel"
                                                    onClick={() => setEditingPersonId(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
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
                                                    {person.last_mentioned
                                                        ? formatEventDate(person.last_mentioned, { day: 'numeric', month: 'short' })
                                                        : 'Unknown'}
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
                                        </>
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
                                        ? formatEventDate(biography.generated_at, {
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
            ) : activeTab === 'letters' ? (
                <LetterToFuture />
            ) : null}

            {/* Edit Event Modal — rendered via portal to escape stacking context */}
            {editingEventId && typeof document !== 'undefined' && createPortal(
                <div className="edit-event-overlay" onClick={() => setEditingEventId(null)}>
                    <div className="edit-event-content" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-event-header">
                            <h3 className="edit-event-heading">Edit Event</h3>
                            <button onClick={() => setEditingEventId(null)} className="edit-event-close">
                                ✕
                            </button>
                        </div>
                        <div className="edit-event-body">
                            <div className="edit-event-field">
                                <label className="edit-event-label">Title</label>
                                <input
                                    type="text"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    className="edit-event-input"
                                    placeholder="Event Title"
                                />
                            </div>
                            <div className="edit-event-field">
                                <label className="edit-event-label">Description</label>
                                <textarea
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="edit-event-textarea"
                                    placeholder="What happened?"
                                />
                            </div>
                            <div className="edit-event-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="edit-event-field">
                                    <label className="edit-event-label">Date</label>
                                    <input
                                        type="date"
                                        value={editForm.event_date}
                                        onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
                                        className="edit-event-input"
                                    />
                                </div>
                                <div className="edit-event-field">
                                    <label className="edit-event-label">Category</label>
                                    <select
                                        value={editForm.category}
                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
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
                                    <label className="edit-event-label">Impact &amp; Significance</label>
                                    <span className="edit-event-range-value" style={{ color: 'var(--accent-primary)' }}>
                                        {editForm.significance}/10
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={editForm.significance}
                                    onChange={(e) => setEditForm({ ...editForm, significance: parseInt(e.target.value) })}
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
                            <button onClick={() => setEditingEventId(null)} className="edit-btn cancel">Cancel</button>
                            <button onClick={() => handleSaveEvent(editingEventId)} className="edit-btn save">Save Changes</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
