'use client';

import { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

function MoodTrendChart({ entries }: { entries: LogEntry[] }) {
    const data = [...entries].reverse()
        .filter(e => e.extracted_entities?.[0]?.mood_score)
        .map(e => ({
            date: new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            mood: e.extracted_entities[0].mood_score,
            title: e.extracted_entities[0].title
        }));

    if (data.length < 2) return null;

    return (
        <div className="mood-chart" style={{ height: '180px', marginBottom: '24px', background: 'rgba(30, 30, 46, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid #2A2A35' }}>
            <h3 style={{ fontSize: '13px', marginBottom: '12px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mood Timeline</h3>
            <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#818CF8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#818CF8" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px', color: '#F3F4F6' }}
                        itemStyle={{ color: '#E5E7EB' }}
                        labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="mood" stroke="#818CF8" fillOpacity={1} fill="url(#colorMood)" strokeWidth={2} activeDot={{ r: 4, fill: '#fff' }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function LogView() {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchEntries();
    }, []);

    const fetchEntries = async () => {
        try {
            const response = await fetch('/api/entries?type=all&limit=50');
            const data = await response.json();
            setEntries(data.entries || []);
            if (!data.entries?.length) {
                console.log('Debug: No entries found in API response', data);
            }
        } catch (error) {
            console.error('Failed to fetch entries:', error);
            // @ts-ignore
            setEntries([{ id: 'error', raw_text: `Error: ${error.message}`, created_at: new Date().toISOString() }]);
        } finally {
            setLoading(false);
        }
    };

    const handleEditStart = (entry: LogEntry) => {
        setEditingId(entry.id);
        // Use raw_text for editing
        setEditContent(entry.raw_text);
        // Prevent card collapse when clicking edit
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditContent('');
    };

    const handleSave = async (reprocess: boolean) => {
        if (!editingId) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingId,
                    raw_text: editContent,
                    reprocess_ai: reprocess
                }),
            });

            if (res.ok) {
                // Refresh entries to show updates
                await fetchEntries();
                setEditingId(null);
                setEditContent('');
            }
        } catch (error) {
            console.error('Failed to save entry:', error);
        } finally {
            setIsSaving(false);
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

    const [activeFilter, setActiveFilter] = useState<'all' | 'reflections' | 'voice' | 'system'>('all');
    const [systemLog, setSystemLog] = useState<any[]>([]);
    const [loadingSystem, setLoadingSystem] = useState(false);

    useEffect(() => {
        if (activeFilter === 'system' && systemLog.length === 0) {
            setLoadingSystem(true);
            fetch('/api/entries?type=system_activity')
                .then(res => res.json())
                .then(data => setSystemLog(data.activity || []))
                .catch(err => console.error(err))
                .finally(() => setLoadingSystem(false));
        }
    }, [activeFilter]);

    const filteredEntries = entries.filter(e => {
        if (activeFilter === 'reflections') return e.extracted_entities?.[0]?.category === 'reflection' || e.raw_text.includes('[Mirror Session]');
        if (activeFilter === 'voice') return e.source === 'voice';
        return true;
    });

    const parseMirrorConversation = (text: string) => {
        // Simple parser for "[Mirror Session]\nUser: ...\nMirror: ..." format
        // Or "[Mirror asked: "..."]\n\nMy answer: ..."
        const lines = text.split('\n');
        const conversation: { role: 'user' | 'assistant'; content: string }[] = [];

        let currentRole: 'user' | 'assistant' = 'user';
        let currentContent = '';

        lines.forEach(line => {
            if (line.startsWith('User: ') || line.startsWith('My answer: ')) {
                if (currentContent) conversation.push({ role: currentRole, content: currentContent.trim() });
                currentRole = 'user';
                currentContent = line.replace(/^(User: |My answer: )/, '');
            } else if (line.startsWith('Mirror: ') || line.startsWith('The Mirror speaks: ')) {
                if (currentContent) conversation.push({ role: currentRole, content: currentContent.trim() });
                currentRole = 'assistant';
                currentContent = line.replace(/^(Mirror: |The Mirror speaks: )/, '');
            } else if (line.startsWith('[Mirror Session]') || line.startsWith('[Mirror asked:')) {
                // Skip header or handle as context (maybe show as system msg?)
                // For now, treat start of Mirror Session as context for first user msg if needed, 
                // but usually the next line clarifies.
            } else {
                currentContent += '\n' + line;
            }
        });
        if (currentContent) conversation.push({ role: currentRole, content: currentContent.trim() });

        return conversation;
    };

    if (loading) {
        return (
            <div className="log-loading">
                <div className="loading-spinner" />
                <p>Loading your story...</p>
            </div>
        );
    }

    // Early return removed to allow access to System Log even if main entries are empty

    return (
        <div className="log-view">
            <div className="log-header">
                <h2>Your Log</h2>
                <div className="flex gap-2 bg-gray-900/50 p-1 rounded-lg border border-gray-800">
                    {['all', 'reflections', 'voice', 'system'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter as any)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeFilter === filter
                                ? 'bg-gray-700 text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                                }`}
                        >
                            {filter === 'system' ? '🖥️ System Log' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {activeFilter === 'all' && entries.length > 0 && <MoodTrendChart entries={entries} />}

            {(activeFilter !== 'system' && filteredEntries.length === 0) ? (
                <div className="log-empty">
                    <span className="empty-icon">📖</span>
                    <h3>Your story begins here</h3>
                    <p>Start with a brain dump to see your entries appear here.</p>
                </div>
            ) : null}

            {activeFilter === 'system' ? (
                <div className="system-log-container flex flex-col gap-0 border border-gray-800 rounded-lg overflow-hidden bg-[#0d0d10] font-mono text-xs mt-4">
                    {loadingSystem ? (
                        <div className="p-8 text-center text-gray-500">Accessing System Core...</div>
                    ) : (
                        systemLog.map((log) => (
                            <div key={log.id} className={`flex gap-3 p-3 border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors ${log.role === 'assistant' ? 'bg-indigo-950/10' : ''
                                }`}>
                                <div className="text-gray-600 w-24 flex-shrink-0 tabular-nums text-[10px] pt-1">
                                    {new Date(log.created_at).toLocaleString('en-IN', {
                                        month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                    })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`uppercase font-bold tracking-wider text-[10px] ${log.role === 'assistant' ? 'text-indigo-400' : 'text-emerald-400'
                                            }`}>
                                            {log.role === 'assistant' ? (log.persona ? `AI (${log.persona})` : 'System') : 'User'}
                                        </span>
                                        {log.source && log.source !== 'chat' && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                                                {log.source.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                                        {log.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {systemLog.length === 0 && !loadingSystem && (
                        <div className="p-8 text-center text-gray-600">No system activity recorded yet.</div>
                    )}
                </div>
            ) : (
                <div className="log-timeline">
                    {filteredEntries.map((entry) => {
                        const entity = entry.extracted_entities?.[0];
                        const isExpanded = expandedId === entry.id;
                        const isEditing = editingId === entry.id;
                        const moodColor = MOOD_COLORS[entity?.mood_score || 5] || '#FBBF24';
                        const selfTalk = SELF_TALK_INDICATOR[entity?.self_talk_tone || 'neutral'];

                        const isReflection = entity?.category === 'reflection' || entry.raw_text.includes('[Mirror Session]');

                        return (
                            <div
                                key={entry.id}
                                className={`log-card ${isExpanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: moodColor, borderLeftWidth: '4px', borderLeftStyle: 'solid' }}
                                onClick={(e) => {
                                    // Don't collapse if clicking inside edit area or buttons
                                    if ((e.target as HTMLElement).closest('.edit-area, .log-card-actions')) return;
                                    setExpandedId(isExpanded ? null : entry.id);
                                }}
                            >
                                <div className="log-card-header">
                                    <div className="log-card-left">
                                        <span className="category-emoji">
                                            {CATEGORY_EMOJI[entity?.category || 'emotion'] || '💭'}
                                        </span>
                                        <div className="log-card-title-block">
                                            <h3 className="log-card-title">
                                                {entity?.title || (isReflection ? 'Mirror Session' : 'Untitled thought')}
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

                                {isEditing ? (
                                    <div className="edit-area" style={{ marginTop: '12px' }}>
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: '120px',
                                                background: '#16161F',
                                                color: '#fff',
                                                border: '1px solid #374151',
                                                borderRadius: '8px',
                                                padding: '12px',
                                                fontSize: '14px',
                                                marginBottom: '8px',
                                                resize: 'vertical'
                                            }}
                                        />
                                        <div className="edit-actions" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                                style={{ padding: '6px 12px', borderRadius: '6px', background: 'transparent', color: '#9CA3AF', border: '1px solid #374151', fontSize: '12px' }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSave(false)}
                                                disabled={isSaving}
                                                style={{ padding: '6px 12px', borderRadius: '6px', background: '#374151', color: '#fff', border: 'none', fontSize: '12px' }}
                                            >
                                                Save Text Only
                                            </button>
                                            <button
                                                onClick={() => handleSave(true)}
                                                disabled={isSaving}
                                                style={{ padding: '6px 12px', borderRadius: '6px', background: '#818CF8', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 500 }}
                                            >
                                                {isSaving ? 'Processing...' : 'Save & Re-Analyze AI'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="log-card-content">
                                        {isReflection ? (
                                            <div className="flex flex-col gap-3 mt-2 bg-gray-900/30 p-3 rounded-lg border border-gray-800/50">
                                                {parseMirrorConversation(entry.raw_text).map((msg, i) => (
                                                    <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                                            {msg.role === 'user' ? 'You' : 'Mirror'}
                                                        </span>
                                                        <div className={`px-3 py-2 rounded-lg text-sm max-w-[90%] ${msg.role === 'user'
                                                            ? 'bg-indigo-900/40 text-indigo-100 border border-indigo-500/20 rounded-tr-sm'
                                                            : 'bg-gray-800 text-gray-300 border border-gray-700 rounded-tl-sm'
                                                            }`}>
                                                            {msg.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p>{entity?.content || entry.raw_text}</p>
                                        )}
                                    </div>
                                )}

                                {isExpanded && !isEditing && entity && (
                                    <div className="log-card-details">
                                        <div className="log-card-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                            <button
                                                onClick={() => handleEditStart(entry)}
                                                style={{
                                                    fontSize: '12px',
                                                    color: '#818CF8',
                                                    background: 'rgba(129, 140, 248, 0.1)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                ✏️ Edit & Update AI
                                            </button>
                                        </div>

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
            )}
        </div>
    );
}
