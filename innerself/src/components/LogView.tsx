'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
    id: string;
    created_at: string;
    raw_text: string;
    source: string;
    audio_url?: string | null;
    audio_duration_sec?: number | null;
    health_metrics: {
        id: string;
        metric_name: string;
        value: string;
        unit: string;
        status: string;
    }[];
    extracted_entities: {
        id: string;
        category: string;
        title: string;
        content: string;
        mood_score: number;
        surface_emotion: string;
        deeper_emotion: string;
        energy_level: number;
        identity_persona: string;
        ai_response: string;
        ai_persona_used: string;
        is_task: boolean;
        task_status: string;
        people_mentioned: { name: string; sentiment: string }[];
        beliefs_revealed: string[];
    }[];
}

const MOOD_COLORS: Record<number, string> = {
    1: '#DC2626',
    2: '#EF4444',
    3: '#F97316',
    4: '#FB923C',
    5: '#FBBF24',
    6: '#A3E635',
    7: '#4ADE80',
    8: '#34D399',
    9: '#2DD4BF',
    10: '#06B6D4',
};

const CATEGORY_EMOJI: Record<string, string> = {
    emotion: '💭',
    task: '✅',
    reflection: '🪞',
    goal: '🎯',
    memory: '📸',
    idea: '💡',
    gratitude: '🙏',
    vent: '🌊',
};

export default function LogView() {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const editTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        fetchEntries();
    }, []);

    useEffect(() => {
        if (editingId && editTextareaRef.current) {
            editTextareaRef.current.focus();
            editTextareaRef.current.style.height = 'auto';
            editTextareaRef.current.style.height = editTextareaRef.current.scrollHeight + 'px';
        }
    }, [editingId]);

    const fetchEntries = async () => {
        try {
            const response = await fetch('/api/entries?type=all&limit=50');
            const data = await response.json();
            setEntries(data.entries || []);
        } catch (error) {
            console.error('Failed to fetch entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (entry: LogEntry) => {
        setEditingId(entry.id);
        setEditText(entry.raw_text);
        setExpandedId(entry.id);
    };

    const handleSaveEdit = async (entryId: string) => {
        if (!editText.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entryId, raw_text: editText.trim() }),
            });
            if (res.ok) {
                // Update local state
                setEntries((prev) =>
                    prev.map((e) =>
                        e.id === entryId ? { ...e, raw_text: editText.trim() } : e
                    )
                );
                setEditingId(null);
            }
        } catch (error) {
            console.error('Failed to save edit:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditText('');
    };

    const handleDelete = async (entryId: string) => {
        try {
            const res = await fetch('/api/entries', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entryId }),
            });
            if (res.ok) {
                setEntries((prev) => prev.filter((e) => e.id !== entryId));
                setDeletingId(null);
                if (expandedId === entryId) setExpandedId(null);
            }
        } catch (error) {
            console.error('Failed to delete entry:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="log-loading">
                <div className="loading-spinner" />
                <p>Loading your story...</p>
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="log-empty">
                <span className="empty-icon">📖</span>
                <h3>Your story begins here</h3>
                <p>Start with a brain dump to see your entries appear here.</p>
            </div>
        );
    }

    return (
        <div className="log-view">
            <div className="log-header">
                <h2>Your Log</h2>
                <span className="entry-count">{entries.length} entries</span>
            </div>

            <div className="log-timeline">
                {entries.map((entry) => {
                    const entity = entry.extracted_entities?.[0];
                    const isExpanded = expandedId === entry.id;
                    const isEditing = editingId === entry.id;
                    const isDeleting = deletingId === entry.id;

                    return (
                        <div
                            key={entry.id}
                            className={`log-card ${isExpanded ? 'expanded' : ''} ${isEditing ? 'editing' : ''}`}
                        >
                            <div
                                className="log-card-header"
                                onClick={() => {
                                    if (!isEditing) setExpandedId(isExpanded ? null : entry.id);
                                }}
                            >
                                <div className="log-card-left">
                                    <span className="category-emoji">
                                        {CATEGORY_EMOJI[entity?.category || 'emotion'] || '💭'}
                                    </span>
                                    <div className="log-card-title-block">
                                        <h3 className="log-card-title">
                                            {entity?.title || 'Untitled thought'}
                                        </h3>
                                        <span className="log-card-time">
                                            {entry.source === 'voice' && '🎙️ '}
                                            {formatDate(entry.created_at)} · {formatTime(entry.created_at)}
                                            {entry.audio_duration_sec ? ` · ${entry.audio_duration_sec}s` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="log-card-right">
                                    <div
                                        className="mood-dot"
                                        style={{
                                            backgroundColor:
                                                MOOD_COLORS[entity?.mood_score || 5],
                                        }}
                                        title={`Mood: ${entity?.mood_score}/10`}
                                    />
                                </div>
                            </div>

                            {/* Content or Edit Mode */}
                            {isEditing ? (
                                <div className="log-edit-area">
                                    <textarea
                                        ref={editTextareaRef}
                                        className="log-edit-textarea"
                                        value={editText}
                                        onChange={(e) => {
                                            setEditText(e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        placeholder="Edit your entry..."
                                    />
                                    <div className="log-edit-actions">
                                        <button
                                            className="edit-btn save"
                                            onClick={() => handleSaveEdit(entry.id)}
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : '✓ Save'}
                                        </button>
                                        <button
                                            className="edit-btn cancel"
                                            onClick={handleCancelEdit}
                                        >
                                            ✕ Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {entry.audio_url && (
                                        <div className="audio-playback">
                                            <audio controls preload="none" className="entry-audio">
                                                <source src={entry.audio_url} type="audio/webm" />
                                                Your browser does not support audio playback.
                                            </audio>
                                        </div>
                                    )}
                                    <p className="log-card-content">
                                        {entity?.content || entry.raw_text}
                                    </p>
                                </>
                            )}

                            {/* Delete Confirmation */}
                            {isDeleting && (
                                <div className="log-delete-confirm">
                                    <p>Delete this entry?</p>
                                    <div className="delete-actions">
                                        <button
                                            className="delete-btn confirm"
                                            onClick={() => handleDelete(entry.id)}
                                        >
                                            Delete
                                        </button>
                                        <button
                                            className="delete-btn cancel"
                                            onClick={() => setDeletingId(null)}
                                        >
                                            Keep
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Expanded Details */}
                            {isExpanded && entity && !isEditing && (
                                <div className="log-card-details">
                                    <div className="detail-row">
                                        <span className="detail-label">Emotions</span>
                                        <span className="detail-value">
                                            {entity.surface_emotion} → {entity.deeper_emotion}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Energy</span>
                                        <span className="detail-value">
                                            {entity.energy_level}/10
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Identity</span>
                                        <span className="detail-value">
                                            {entity.identity_persona}
                                        </span>
                                    </div>
                                    {entity.people_mentioned?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">People</span>
                                            <span className="detail-value">
                                                {entity.people_mentioned
                                                    .map((p) => p.name)
                                                    .join(', ')}
                                            </span>
                                        </div>
                                    )}
                                    {entity.beliefs_revealed?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Beliefs</span>
                                            <span className="detail-value">
                                                {entity.beliefs_revealed.map((b, i) => (
                                                    <span key={i} className="belief-tag">{b}</span>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                    {entry.health_metrics?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Health</span>
                                            <span className="detail-value">
                                                {entry.health_metrics.map((h, i) => (
                                                    <span key={i} className="health-tag">
                                                        {h.metric_name}: {h.value}{h.unit} {h.status ? `(${h.status})` : ''}
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    )}
                                    <div className="ai-reply">
                                        <span className="ai-reply-persona">
                                            {entity.ai_persona_used}
                                        </span>
                                        <p>{entity.ai_response}</p>
                                    </div>

                                    {/* Edit/Delete Actions */}
                                    <div className="log-entry-actions">
                                        <button
                                            className="entry-action-btn edit"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEdit(entry);
                                            }}
                                            title="Edit entry"
                                        >
                                            ✏️ Edit
                                        </button>
                                        <button
                                            className="entry-action-btn delete"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeletingId(entry.id);
                                            }}
                                            title="Delete entry"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="log-card-tags">
                                <span className="tag category-tag">
                                    {entity?.category}
                                </span>
                                {entity?.is_task && (
                                    <span className="tag task-tag">
                                        {entity.task_status || 'pending'}
                                    </span>
                                )}
                                <span className="tag source-tag">
                                    {entry.source === 'voice' ? '🎙️' : '⌨️'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
