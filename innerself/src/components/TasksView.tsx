'use client';

import { useState, useEffect } from 'react';

interface Task {
    id: string;
    entry_id: string;
    title: string;
    content: string;
    task_status: string;
    task_due_date: string | null;
    mood_score: number;
    category: string;
    surface_emotion: string;
    deeper_emotion: string;
    core_need: string;
    energy_level: number;
    identity_persona: string;
    body_signals: string[];
    triggers: string[];
    people_mentioned: { name: string; sentiment: string }[];
    created_at: string;
    age_days: number;
    is_stale: boolean;
}

export default function TasksView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'done' | 'stale'>('all');

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        try {
            const response = await fetch('/api/entries?type=tasks&limit=100');
            const data = await response.json();
            setTasks(data.entries || []);
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateTaskStatus = async (id: string, status: 'pending' | 'done' | 'cancelled') => {
        try {
            await fetch('/api/entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, task_status: status }),
            });

            setTasks((prev) =>
                prev.map((t) => (t.id === id ? { ...t, task_status: status } : t))
            );
        } catch (error) {
            console.error('Failed to update task:', error);
        }
    };

    const filteredTasks = tasks.filter((t) => {
        if (filter === 'pending') return t.task_status === 'pending';
        if (filter === 'done') return t.task_status === 'done' || t.task_status === 'cancelled';
        if (filter === 'stale') return t.is_stale;
        return true;
    });

    const pendingCount = tasks.filter((t) => t.task_status === 'pending').length;
    const doneCount = tasks.filter((t) => t.task_status === 'done' || t.task_status === 'cancelled').length;
    const staleCount = tasks.filter((t) => t.is_stale).length;

    if (loading) {
        return (
            <div className="tasks-loading">
                <div className="loading-spinner" />
                <p>Loading tasks...</p>
            </div>
        );
    }

    return (
        <div className="tasks-view">
            <div className="tasks-header">
                <h2>Tasks</h2>
                <div className="tasks-stats">
                    <span className="stat pending">{pendingCount} pending</span>
                    <span className="stat done">{doneCount} done</span>
                    {staleCount > 0 && (
                        <span className="stat stale">⚠️ {staleCount} stale</span>
                    )}
                </div>
            </div>

            <div className="tasks-filter">
                {(['all', 'pending', 'stale', 'done'] as const).map((f) => (
                    <button
                        key={f}
                        className={`filter-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'stale' ? `⚠️ Stale (${staleCount})` : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {/* Staleness Warning Banner */}
            {staleCount > 0 && filter !== 'done' && (
                <div className="stale-warning-banner">
                    ⚠️ {staleCount} task{staleCount > 1 ? 's have' : ' has'} been pending for over 14 days. What&apos;s blocking you?
                </div>
            )}

            {filteredTasks.length === 0 ? (
                <div className="tasks-empty">
                    <span className="empty-icon">✅</span>
                    <h3>
                        {filter === 'pending' ? 'No pending tasks!' :
                            filter === 'done' ? 'No completed tasks yet' :
                                filter === 'stale' ? 'No stale tasks — nice!' :
                                    'No tasks yet'}
                    </h3>
                    <p>Tasks are automatically extracted from your brain dumps.</p>
                </div>
            ) : (
                <div className="tasks-list">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`task-card ${task.task_status === 'done' ? 'completed' : ''} ${task.task_status === 'cancelled' ? 'cancelled' : ''}`}
                            style={task.is_stale ? { borderLeft: '3px solid #F97316' } : undefined}
                        >
                            <div className="task-checkbox-area">
                                <button
                                    className={`task-checkbox ${task.task_status === 'done' ? 'checked' : ''}`}
                                    onClick={() =>
                                        updateTaskStatus(task.id, task.task_status === 'done' ? 'pending' : 'done')
                                    }
                                >
                                    {task.task_status === 'done' && (
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                        </svg>
                                    )}
                                </button>
                            </div>

                            <div className="task-content">
                                <h3 className="task-title">{task.title}</h3>
                                <p className="task-description">{task.content}</p>

                                {/* Emotional Context */}
                                {task.surface_emotion && task.task_status === 'pending' && (
                                    <p className="task-emotion-context">
                                        Feeling: {task.surface_emotion}{task.deeper_emotion ? ` → ${task.deeper_emotion}` : ''}
                                        {task.core_need ? ` · Need: ${task.core_need}` : ''}
                                    </p>
                                )}

                                <div className="task-meta">
                                    {task.task_due_date && (
                                        <span className="task-due">
                                            📅 {new Date(task.task_due_date).toLocaleDateString('en-IN', {
                                                day: 'numeric', month: 'short',
                                            })}
                                        </span>
                                    )}
                                    <span className="task-created">
                                        {new Date(task.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short',
                                        })}
                                    </span>
                                    {task.age_days > 0 && (
                                        <span className={`task-age${task.is_stale ? ' stale' : ''}`}>
                                            · {task.age_days}d ago
                                        </span>
                                    )}
                                    {task.is_stale && (
                                        <span className="task-stale-label">
                                            · ⚠️ STALE
                                        </span>
                                    )}
                                    {task.people_mentioned?.length > 0 && (
                                        <span className="task-people">
                                            · {task.people_mentioned.map(p => p.name).join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {task.task_status === 'pending' && (
                                <button
                                    className="task-cancel"
                                    onClick={() => updateTaskStatus(task.id, 'cancelled')}
                                    title="Cancel task"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
