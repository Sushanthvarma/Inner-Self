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
    created_at: string;
}

export default function TasksView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');

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

    const updateTaskStatus = async (
        id: string,
        status: 'pending' | 'done' | 'cancelled'
    ) => {
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
        if (filter === 'done')
            return t.task_status === 'done' || t.task_status === 'cancelled';
        return true;
    });

    const pendingCount = tasks.filter((t) => t.task_status === 'pending').length;
    const doneCount = tasks.filter(
        (t) => t.task_status === 'done' || t.task_status === 'cancelled'
    ).length;

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
                </div>
            </div>

            <div className="tasks-filter">
                {(['all', 'pending', 'done'] as const).map((f) => (
                    <button
                        key={f}
                        className={`filter-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            {filteredTasks.length === 0 ? (
                <div className="tasks-empty">
                    <span className="empty-icon">✅</span>
                    <h3>
                        {filter === 'pending'
                            ? 'No pending tasks!'
                            : filter === 'done'
                                ? 'No completed tasks yet'
                                : 'No tasks yet'}
                    </h3>
                    <p>Tasks are automatically extracted from your brain dumps.</p>
                </div>
            ) : (
                <div className="tasks-list">
                    {filteredTasks.map((task) => (
                        <div
                            key={task.id}
                            className={`task-card ${task.task_status === 'done' ? 'completed' : ''} ${task.task_status === 'cancelled' ? 'cancelled' : ''}`}
                        >
                            <div className="task-checkbox-area">
                                <button
                                    className={`task-checkbox ${task.task_status === 'done' ? 'checked' : ''}`}
                                    onClick={() =>
                                        updateTaskStatus(
                                            task.id,
                                            task.task_status === 'done' ? 'pending' : 'done'
                                        )
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
                                <div className="task-meta">
                                    {task.task_due_date && (
                                        <span className="task-due">
                                            📅 {new Date(task.task_due_date).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </span>
                                    )}
                                    <span className="task-created">
                                        {new Date(task.created_at).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                        })}
                                    </span>
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
