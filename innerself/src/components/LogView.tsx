'use client';

import { useState, useEffect } from 'react';

interface ExtractedEntity {
    id: string;
    category: string;
    title: string;
    content: string;
    mood_score: number;
    surface_emotion: string;
    deeper_emotion: string;
    core_need: string;
    triggers: string[];
    defense_mechanism: string | null;
    self_talk_tone: string;
    energy_level: number;
    cognitive_pattern: string | null;
    beliefs_revealed: string[];
    avoidance_signal: string | null;
    growth_edge: string | null;
    identity_persona: string;
    body_signals: string[];
    is_task: boolean;
    task_status: string;
    people_mentioned: { name: string; sentiment: string; relationship: string; context: string }[];
    ai_response: string;
    ai_persona_used: string;
    follow_up_question: string | null;
}

interface LogEntry {
    id: string;
    created_at: string;
    raw_text: string;
    source: string;
    audio_url: string | null;
    extracted_entities: ExtractedEntity[];
}

const MOOD_COLORS: Record<number, string> = {
    1: '#DC2626', 2: '#EF4444', 3: '#F97316', 4: '#FB923C', 5: '#FBBF24',
    6: '#A3E635', 7: '#4ADE80', 8: '#34D399', 9: '#2DD4BF', 10: '#06B6D4',
};

const CATEGORY_EMOJI: Record<string, string> = {
    emotion: '💭', task: '✅', reflection: '🪞', goal: '🎯',
    memory: '📸', idea: '💡', gratitude: '🙏', vent: '🌊',
};

const SELF_TALK_INDICATOR: Record<string, { emoji: string; color: string }> = {
    critical: { emoji: '🔴', color: '#EF4444' },
    neutral: { emoji: '🟡', color: '#FBBF24' },
    compassionate: { emoji: '🟢', color: '#4ADE80' },
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
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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
                    const moodColor = MOOD_COLORS[entity?.mood_score || 5] || '#FBBF24';
                    const selfTalk = SELF_TALK_INDICATOR[entity?.self_talk_tone || 'neutral'];

                    return (
                        <div
                            key={entry.id}
                            className={`log-card ${isExpanded ? 'expanded' : ''}`}
                            style={{ borderLeftColor: moodColor, borderLeftWidth: '4px', borderLeftStyle: 'solid' }}
                            onClick={() => setExpandedId(isExpanded ? null : entry.id)}
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span title={`Self-talk: ${entity?.self_talk_tone}`} style={{ fontSize: '10px' }}>
                                        {selfTalk?.emoji}
                                    </span>
                                    <div
                                        className="mood-dot"
                                        style={{ backgroundColor: moodColor }}
                                        title={`Mood: ${entity?.mood_score}/10`}
                                    />
                                </div>
                            </div>

                            <p className="log-card-content">
                                {entity?.content || entry.raw_text}
                            </p>

                            {isExpanded && entity && (
                                <div className="log-card-details">
                                    {/* Emotions Row */}
                                    <div className="detail-row">
                                        <span className="detail-label">Emotions</span>
                                        <span className="detail-value">
                                            {entity.surface_emotion}{entity.deeper_emotion ? ` → ${entity.deeper_emotion}` : ''}
                                        </span>
                                    </div>

                                    {/* Core Need */}
                                    {entity.core_need && (
                                        <div className="detail-row">
                                            <span className="detail-label">Core Need</span>
                                            <span className="detail-value">{entity.core_need}</span>
                                        </div>
                                    )}

                                    {/* Energy */}
                                    <div className="detail-row">
                                        <span className="detail-label">Energy</span>
                                        <span className="detail-value">
                                            <span style={{
                                                display: 'inline-block',
                                                width: `${(entity.energy_level / 10) * 60}px`,
                                                height: '8px',
                                                borderRadius: '4px',
                                                backgroundColor: entity.energy_level <= 3 ? '#EF4444' : entity.energy_level <= 6 ? '#FBBF24' : '#4ADE80',
                                                marginRight: '6px',
                                                verticalAlign: 'middle',
                                            }} />
                                            {entity.energy_level}/10
                                        </span>
                                    </div>

                                    {/* Self-Talk */}
                                    <div className="detail-row">
                                        <span className="detail-label">Self-Talk</span>
                                        <span className="detail-value" style={{ color: selfTalk?.color }}>
                                            {entity.self_talk_tone}
                                        </span>
                                    </div>

                                    {/* Identity */}
                                    <div className="detail-row">
                                        <span className="detail-label">Identity</span>
                                        <span className="detail-value">{entity.identity_persona}</span>
                                    </div>

                                    {/* Triggers */}
                                    {entity.triggers?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Triggers</span>
                                            <span className="detail-value">{entity.triggers.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* Defense Mechanism */}
                                    {entity.defense_mechanism && (
                                        <div className="detail-row">
                                            <span className="detail-label">Defense</span>
                                            <span className="detail-value">{entity.defense_mechanism}</span>
                                        </div>
                                    )}

                                    {/* Cognitive Pattern */}
                                    {entity.cognitive_pattern && (
                                        <div className="detail-row">
                                            <span className="detail-label">Pattern</span>
                                            <span className="detail-value">{entity.cognitive_pattern}</span>
                                        </div>
                                    )}

                                    {/* Beliefs */}
                                    {entity.beliefs_revealed?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Beliefs</span>
                                            <span className="detail-value">
                                                {entity.beliefs_revealed.map((b, i) => (
                                                    <span key={i} className="tag belief-tag">{b}</span>
                                                ))}
                                            </span>
                                        </div>
                                    )}

                                    {/* Avoidance */}
                                    {entity.avoidance_signal && (
                                        <div className="detail-row">
                                            <span className="detail-label">Avoiding</span>
                                            <span className="detail-value" style={{ color: '#F97316' }}>{entity.avoidance_signal}</span>
                                        </div>
                                    )}

                                    {/* Growth Edge */}
                                    {entity.growth_edge && (
                                        <div className="detail-row">
                                            <span className="detail-label">Growth</span>
                                            <span className="detail-value" style={{ color: '#4ADE80' }}>{entity.growth_edge}</span>
                                        </div>
                                    )}

                                    {/* Body Signals */}
                                    {entity.body_signals?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">Body</span>
                                            <span className="detail-value">{entity.body_signals.join(', ')}</span>
                                        </div>
                                    )}

                                    {/* People */}
                                    {entity.people_mentioned?.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-label">People</span>
                                            <span className="detail-value">
                                                {entity.people_mentioned.map((p, i) => (
                                                    <span key={i} className="tag people-tag">
                                                        {p.name} ({p.sentiment})
                                                    </span>
                                                ))}
                                            </span>
                                        </div>
                                    )}

                                    {/* AI Response */}
                                    <div className="ai-reply">
                                        <span className="ai-reply-persona">{entity.ai_persona_used}</span>
                                        <p>{entity.ai_response}</p>
                                    </div>

                                    {/* Follow-up Question */}
                                    {entity.follow_up_question && (
                                        <div className="follow-up">
                                            <p className="follow-up-label">Question for later:</p>
                                            <p className="follow-up-text">{entity.follow_up_question}</p>
                                        </div>
                                    )}

                                    {/* Audio Playback */}
                                    {entry.audio_url && (
                                        <div className="detail-row">
                                            <span className="detail-label">Audio</span>
                                            <audio controls src={entry.audio_url} style={{ height: '32px', width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="log-card-tags">
                                <span className="tag category-tag">{entity?.category}</span>
                                {entity?.is_task && (
                                    <span className="tag task-tag">{entity.task_status || 'pending'}</span>
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
