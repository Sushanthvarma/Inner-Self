'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar, LineChart, Line, Cell
} from 'recharts';

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

const CATEGORY_COLORS: Record<string, string> = {
    emotion: '#818CF8',
    task: '#34D399',
    reflection: '#F59E0B',
    goal: '#3B82F6',
    memory: '#EC4899',
    idea: '#A78BFA',
    gratitude: '#10B981',
    vent: '#EF4444',
};

const SELF_TALK_INDICATOR: Record<string, { emoji: string; color: string }> = {
    critical: { emoji: '🔴', color: '#EF4444' },
    neutral: { emoji: '🟡', color: '#FBBF24' },
    compassionate: { emoji: '🟢', color: '#4ADE80' },
};

/* ─── Mood Timeline Chart ─── */
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
        <div className="log-chart-card">
            <h3 className="log-chart-title">Mood Timeline</h3>
            <div className="log-chart-body" style={{ height: '150px' }}>
                <ResponsiveContainer width="100%" height="100%">
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
        </div>
    );
}

/* ─── Category Distribution Chart (horizontal bar) ─── */
function CategoryDistributionChart({ entries }: { entries: LogEntry[] }) {
    const data = useMemo(() => {
        const counts: Record<string, number> = {};
        entries.forEach(e => {
            const cat = e.extracted_entities?.[0]?.category;
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count, fill: CATEGORY_COLORS[name] || '#6B7280' }))
            .sort((a, b) => b.count - a.count);
    }, [entries]);

    if (data.length < 1) return null;

    return (
        <div className="log-chart-card">
            <h3 className="log-chart-title">Category Distribution</h3>
            <div className="log-chart-body" style={{ height: `${Math.max(120, data.length * 32)}px` }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} opacity={0.5} />
                        <XAxis type="number" hide />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="#6B7280"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            width={72}
                            tickFormatter={(v: string) => `${CATEGORY_EMOJI[v] || ''} ${v}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '12px', color: '#F3F4F6' }}
                            itemStyle={{ color: '#E5E7EB' }}
                            labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                            formatter={(value) => [value, 'Entries']}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
                            {data.map((entry, index) => (
                                <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* ─── Energy Trend Chart ─── */
function EnergyTrendChart({ entries }: { entries: LogEntry[] }) {
    const data = useMemo(() => {
        return [...entries].reverse()
            .filter(e => e.extracted_entities?.[0]?.energy_level != null)
            .map(e => ({
                date: new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
                energy: e.extracted_entities[0].energy_level,
                title: e.extracted_entities[0].title
            }));
    }, [entries]);

    if (data.length < 2) return null;

    return (
        <div className="log-chart-card">
            <h3 className="log-chart-title">Energy Trend</h3>
            <div className="log-chart-body" style={{ height: '150px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <defs>
                            <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#34D399" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
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
                        <Line type="monotone" dataKey="energy" stroke="#34D399" strokeWidth={2} dot={{ r: 3, fill: '#34D399' }} activeDot={{ r: 5, fill: '#fff', stroke: '#34D399', strokeWidth: 2 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* ─── Self-Talk Ratio Bar (div-based) ─── */
function SelfTalkRatioBar({ entries }: { entries: LogEntry[] }) {
    const { critical, neutral, compassionate, total } = useMemo(() => {
        let critical = 0, neutral = 0, compassionate = 0;
        entries.forEach(e => {
            const tone = e.extracted_entities?.[0]?.self_talk_tone;
            if (tone === 'critical') critical++;
            else if (tone === 'compassionate') compassionate++;
            else if (tone) neutral++;
        });
        return { critical, neutral, compassionate, total: critical + neutral + compassionate };
    }, [entries]);

    if (total === 0) return null;

    const pctCritical = Math.round((critical / total) * 100);
    const pctNeutral = Math.round((neutral / total) * 100);
    const pctCompassionate = 100 - pctCritical - pctNeutral;

    return (
        <div className="log-chart-card">
            <h3 className="log-chart-title">Self-Talk Ratio</h3>
            <div className="self-talk-ratio-bar">
                {pctCritical > 0 && (
                    <div
                        className="self-talk-segment critical"
                        style={{ width: `${pctCritical}%` }}
                        title={`Critical: ${critical} (${pctCritical}%)`}
                    />
                )}
                {pctNeutral > 0 && (
                    <div
                        className="self-talk-segment neutral"
                        style={{ width: `${pctNeutral}%` }}
                        title={`Neutral: ${neutral} (${pctNeutral}%)`}
                    />
                )}
                {pctCompassionate > 0 && (
                    <div
                        className="self-talk-segment compassionate"
                        style={{ width: `${pctCompassionate}%` }}
                        title={`Compassionate: ${compassionate} (${pctCompassionate}%)`}
                    />
                )}
            </div>
            <div className="self-talk-legend">
                <span className="self-talk-legend-item">
                    <span className="self-talk-dot critical" /> Critical {pctCritical}%
                </span>
                <span className="self-talk-legend-item">
                    <span className="self-talk-dot neutral" /> Neutral {pctNeutral}%
                </span>
                <span className="self-talk-legend-item">
                    <span className="self-talk-dot compassionate" /> Compassionate {pctCompassionate}%
                </span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                            */
/* ═══════════════════════════════════════════════════════════ */

export default function LogView() {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Filter / search state
    const [activeFilter, setActiveFilter] = useState<'all' | 'reflections' | 'voice' | 'system'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCharts, setShowCharts] = useState(true);
    const [personFilter, setPersonFilter] = useState<string | null>(null);

    // System log state
    const [systemLog, setSystemLog] = useState<any[]>([]);
    const [loadingSystem, setLoadingSystem] = useState(false);

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

    /* ── Edit handlers ── */
    const handleEditStart = (entry: LogEntry) => {
        setEditingId(entry.id);
        setEditContent(entry.raw_text);
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

    /* ── Date formatting ── */
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

    /* ── System log fetch ── */
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

    /* ── Unique categories from entries ── */
    const uniqueCategories = useMemo(() => {
        const cats = new Set<string>();
        entries.forEach(e => {
            const cat = e.extracted_entities?.[0]?.category;
            if (cat) cats.add(cat);
        });
        return Array.from(cats).sort();
    }, [entries]);

    /* ── Filtered entries (type filter → category filter → person filter → search) ── */
    const filteredEntries = useMemo(() => {
        let result = entries;

        // 1. Type filter
        if (activeFilter === 'reflections') {
            result = result.filter(e =>
                e.extracted_entities?.[0]?.category === 'reflection' || e.raw_text.includes('[Mirror Session]')
            );
        } else if (activeFilter === 'voice') {
            result = result.filter(e => e.source === 'voice');
        }

        // 2. Category filter
        if (categoryFilter) {
            result = result.filter(e => e.extracted_entities?.[0]?.category === categoryFilter);
        }

        // 3. Person filter
        if (personFilter) {
            result = result.filter(e =>
                e.extracted_entities?.[0]?.people_mentioned?.some(
                    p => p.name.toLowerCase() === personFilter.toLowerCase()
                )
            );
        }

        // 4. Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(e => {
                const entity = e.extracted_entities?.[0];
                return (
                    e.raw_text.toLowerCase().includes(q) ||
                    (entity?.title?.toLowerCase().includes(q)) ||
                    (entity?.content?.toLowerCase().includes(q))
                );
            });
        }

        return result;
    }, [entries, activeFilter, categoryFilter, personFilter, searchQuery]);

    const hasActiveFilters = categoryFilter !== null || personFilter !== null || searchQuery.trim() !== '';

    const clearAllFilters = () => {
        setCategoryFilter(null);
        setPersonFilter(null);
        setSearchQuery('');
    };

    /* ── Tag click handlers ── */
    const handleCategoryTagClick = (e: React.MouseEvent, category: string) => {
        e.stopPropagation();
        setCategoryFilter(prev => prev === category ? null : category);
        setPersonFilter(null);
    };

    const handlePersonTagClick = (e: React.MouseEvent, personName: string) => {
        e.stopPropagation();
        setPersonFilter(prev => prev === personName ? null : personName);
        setCategoryFilter(null);
    };

    const handleBeliefTagClick = (e: React.MouseEvent, belief: string) => {
        e.stopPropagation();
        setSearchQuery(belief);
        setCategoryFilter(null);
        setPersonFilter(null);
    };

    /* ── Mirror conversation parser ── */
    const parseMirrorConversation = (text: string) => {
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
                // Skip header lines
            } else {
                currentContent += '\n' + line;
            }
        });
        if (currentContent) conversation.push({ role: currentRole, content: currentContent.trim() });

        return conversation;
    };

    /* ── Loading state ── */
    if (loading) {
        return (
            <div className="log-loading">
                <div className="loading-spinner" />
                <p>Loading your story...</p>
            </div>
        );
    }

    const showChartsSection = showCharts && activeFilter === 'all' && entries.length > 0;

    return (
        <div className="log-view">
            {/* ── Header ── */}
            <div className="log-header">
                <h2>Your Log</h2>
                <div className="log-filters">
                    {['all', 'reflections', 'voice', 'system'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => {
                                setActiveFilter(filter as any);
                                if (filter === 'system') {
                                    setCategoryFilter(null);
                                    setPersonFilter(null);
                                    setSearchQuery('');
                                }
                            }}
                            className={`log-filter-btn ${activeFilter === filter ? 'active' : ''}`}
                        >
                            {filter === 'system' ? '🖥️ System Log' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Search bar (hidden for system log) ── */}
            {activeFilter !== 'system' && (
                <div className="log-search-bar">
                    <span className="log-search-icon">🔍</span>
                    <input
                        type="text"
                        className="log-search-input"
                        placeholder="Search entries by title, content..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="log-search-clear" onClick={() => setSearchQuery('')}>✕</button>
                    )}
                </div>
            )}

            {/* ── Category chips + active filter info ── */}
            {activeFilter !== 'system' && uniqueCategories.length > 0 && (
                <div className="log-category-chips">
                    {uniqueCategories.map(cat => (
                        <button
                            key={cat}
                            className={`log-category-chip ${categoryFilter === cat ? 'active' : ''}`}
                            onClick={() => {
                                setCategoryFilter(prev => prev === cat ? null : cat);
                                setPersonFilter(null);
                            }}
                        >
                            {CATEGORY_EMOJI[cat] || '📌'} {cat}
                        </button>
                    ))}
                    {personFilter && (
                        <span className="log-active-person-chip">
                            👤 {personFilter}
                            <button className="log-chip-remove" onClick={() => setPersonFilter(null)}>✕</button>
                        </span>
                    )}
                </div>
            )}

            {/* ── Active filters banner ── */}
            {activeFilter !== 'system' && hasActiveFilters && (
                <div className="log-active-filters">
                    <span className="log-filter-count">
                        Showing {filteredEntries.length} of {entries.length} entries
                    </span>
                    <button className="log-clear-filters" onClick={clearAllFilters}>
                        Clear filters
                    </button>
                </div>
            )}

            {/* ── Charts toggle + section ── */}
            {activeFilter === 'all' && entries.length > 0 && (
                <button
                    className={`log-charts-toggle ${showCharts ? 'active' : ''}`}
                    onClick={() => setShowCharts(prev => !prev)}
                >
                    📊 {showCharts ? 'Hide Charts' : 'Charts'}
                </button>
            )}

            {showChartsSection && (
                <div className="log-charts-section">
                    <MoodTrendChart entries={entries} />
                    <div className="log-charts-grid">
                        <CategoryDistributionChart entries={entries} />
                        <EnergyTrendChart entries={entries} />
                    </div>
                    <SelfTalkRatioBar entries={entries} />
                </div>
            )}

            {/* ── Empty state ── */}
            {activeFilter !== 'system' && filteredEntries.length === 0 ? (
                <div className="log-empty">
                    <span className="empty-icon">📖</span>
                    <h3>{hasActiveFilters ? 'No matching entries' : 'Your story begins here'}</h3>
                    <p>
                        {hasActiveFilters
                            ? 'Try adjusting your filters or search query.'
                            : 'Start with a brain dump to see your entries appear here.'}
                    </p>
                    {hasActiveFilters && (
                        <button className="log-clear-filters" onClick={clearAllFilters}>
                            Clear all filters
                        </button>
                    )}
                </div>
            ) : null}

            {/* ── System Log View ── */}
            {activeFilter === 'system' ? (
                <div className="system-log-container">
                    {loadingSystem ? (
                        <div className="system-log-loading">Accessing System Core...</div>
                    ) : (
                        systemLog.map((log) => (
                            <div key={log.id} className={`system-log-entry${log.role === 'assistant' ? ' ai' : ''}`}>
                                <div className="system-log-time">
                                    {new Date(log.created_at).toLocaleString('en-IN', {
                                        month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                    })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`system-log-role ${log.role === 'assistant' ? 'system-log-role-ai' : 'system-log-role-user'}`}>
                                            {log.role === 'assistant' ? (log.persona ? `AI (${log.persona})` : 'System') : 'User'}
                                        </span>
                                        {log.source && log.source !== 'chat' && (
                                            <span className="system-log-source">
                                                {log.source.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="system-log-content">
                                        {log.content}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {systemLog.length === 0 && !loadingSystem && (
                        <div className="system-log-empty">No system activity recorded yet.</div>
                    )}
                </div>
            ) : (
                /* ── Entries Timeline ── */
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
                                style={{ borderLeftColor: moodColor }}
                                onClick={(e) => {
                                    if ((e.target as HTMLElement).closest('.edit-area, .log-card-actions, .tag.clickable')) return;
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
                                    <div className="log-card-indicators">
                                        <span title={`Self-talk: ${entity?.self_talk_tone}`} className="self-talk-emoji">
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
                                            className="log-edit-textarea"
                                        />
                                        <div className="edit-actions">
                                            <button
                                                onClick={handleCancelEdit}
                                                disabled={isSaving}
                                                className="edit-btn cancel"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSave(false)}
                                                disabled={isSaving}
                                                className="edit-btn save"
                                            >
                                                Save Text Only
                                            </button>
                                            <button
                                                onClick={() => handleSave(true)}
                                                disabled={isSaving}
                                                className="edit-btn reprocess"
                                            >
                                                {isSaving ? 'Processing...' : 'Save & Re-Analyze AI'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="log-card-content">
                                        {isReflection ? (
                                            <div className="mirror-conversation">
                                                {parseMirrorConversation(entry.raw_text).map((msg, i) => (
                                                    <div key={i} className={`mirror-msg ${msg.role}`}>
                                                        <span className="mirror-msg-label">
                                                            {msg.role === 'user' ? 'You' : 'Mirror'}
                                                        </span>
                                                        <div className="mirror-msg-bubble">
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
                                            <button onClick={() => handleEditStart(entry)} className="entry-action-btn edit">
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
                                                <span className={`energy-bar ${entity.energy_level <= 3 ? 'low' : entity.energy_level <= 6 ? 'mid' : 'high'}`} style={{ width: `${(entity.energy_level / 10) * 60}px` }} />
                                                {entity.energy_level}/10
                                            </span>
                                        </div>

                                        {/* Self-Talk */}
                                        <div className="detail-row">
                                            <span className="detail-label">Self-Talk</span>
                                            <span className={`detail-value self-talk-${entity.self_talk_tone}`}>
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

                                        {/* Beliefs — clickable */}
                                        {entity.beliefs_revealed?.length > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">Beliefs</span>
                                                <span className="detail-value">
                                                    {entity.beliefs_revealed.map((b, i) => (
                                                        <span
                                                            key={i}
                                                            className="tag belief-tag clickable"
                                                            onClick={(e) => handleBeliefTagClick(e, b)}
                                                        >
                                                            {b}
                                                        </span>
                                                    ))}
                                                </span>
                                            </div>
                                        )}

                                        {/* Avoidance */}
                                        {entity.avoidance_signal && (
                                            <div className="detail-row">
                                                <span className="detail-label">Avoiding</span>
                                                <span className="detail-value avoidance">{entity.avoidance_signal}</span>
                                            </div>
                                        )}

                                        {/* Growth Edge */}
                                        {entity.growth_edge && (
                                            <div className="detail-row">
                                                <span className="detail-label">Growth</span>
                                                <span className="detail-value growth">{entity.growth_edge}</span>
                                            </div>
                                        )}

                                        {/* Body Signals */}
                                        {entity.body_signals?.length > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">Body</span>
                                                <span className="detail-value">{entity.body_signals.join(', ')}</span>
                                            </div>
                                        )}

                                        {/* People — clickable */}
                                        {entity.people_mentioned?.length > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">People</span>
                                                <span className="detail-value">
                                                    {entity.people_mentioned.map((p, i) => (
                                                        <span
                                                            key={i}
                                                            className="tag people-tag clickable"
                                                            onClick={(e) => handlePersonTagClick(e, p.name)}
                                                        >
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

                                {/* Card footer tags — category is clickable */}
                                <div className="log-card-tags">
                                    <span
                                        className={`tag category-tag clickable ${categoryFilter === entity?.category ? 'active' : ''}`}
                                        onClick={(e) => entity?.category && handleCategoryTagClick(e, entity.category)}
                                    >
                                        {entity?.category}
                                    </span>
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
