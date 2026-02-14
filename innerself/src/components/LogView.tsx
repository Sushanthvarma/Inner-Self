'use client';

import { useState, useEffect } from 'react';

interface LogEntry {
    id: string;
    created_at: string;
    raw_text: string;
    source: string;
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

    useEffect(() => {
        fetchEntries();
    }, []);

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

                    return (
                        <div
                            key={entry.id}
                            className={`log-card ${isExpanded ? 'expanded' : ''}`}
                            onClick={() =>
                                setExpandedId(isExpanded ? null : entry.id)
                            }
                        >
                            <div className="log-card-header">
                                <div className="log-card-left">
                                    <span className="category-emoji">
                                        {CATEGORY_EMOJI[entity?.category || 'emotion'] || '💭'}
                                    </span>
                                    <div className="log-card-title-block">
                                        <h3 className="log-card-title">
                                            {entity?.title || 'Untitled thought'}
                                        </h3>
                                        <span className="log-card-time">
                                            {formatDate(entry.created_at)} · {formatTime(entry.created_at)}
                                        </span>
                                    </div>
                                </div>
                                <div
                                    className="mood-dot"
                                    style={{
                                        backgroundColor:
                                            MOOD_COLORS[entity?.mood_score || 5],
                                    }}
                                    title={`Mood: ${entity?.mood_score}/10`}
                                />
                            </div>

                            <p className="log-card-content">
                                {entity?.content || entry.raw_text}
                            </p>

                            {isExpanded && entity && (
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
                                    <div className="ai-reply">
                                        <span className="ai-reply-persona">
                                            {entity.ai_persona_used}
                                        </span>
                                        <p>{entity.ai_response}</p>
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
