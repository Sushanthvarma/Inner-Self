'use client';

import { useState, useEffect, useCallback } from 'react';

interface Letter {
    id: string;
    letter_text: string | null;
    written_at: string;
    unlock_at: string;
    is_unlocked: boolean;
    is_read: boolean;
    read_at: string | null;
    mood_when_written: number | null;
    context_summary: string | null;
    tags: string[];
    days_until_unlock: number;
}

type ViewMode = 'list' | 'write' | 'read';

export default function LetterToFuture() {
    const [letters, setLetters] = useState<Letter[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Write form state
    const [letterText, setLetterText] = useState('');
    const [unlockOption, setUnlockOption] = useState<'1m' | '3m' | '6m' | '1y' | 'custom'>('3m');
    const [customDate, setCustomDate] = useState('');
    const [currentMood, setCurrentMood] = useState(5);
    const [saving, setSaving] = useState(false);

    // Read state
    const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

    const fetchLetters = useCallback(async () => {
        try {
            const res = await fetch('/api/letters');
            const data = await res.json();
            setLetters(data.letters || []);
        } catch (err) {
            console.error('Failed to fetch letters:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLetters();
    }, [fetchLetters]);

    const getUnlockDate = (): string => {
        const now = new Date();
        switch (unlockOption) {
            case '1m': now.setMonth(now.getMonth() + 1); break;
            case '3m': now.setMonth(now.getMonth() + 3); break;
            case '6m': now.setMonth(now.getMonth() + 6); break;
            case '1y': now.setFullYear(now.getFullYear() + 1); break;
            case 'custom': return customDate ? new Date(customDate).toISOString() : '';
        }
        return now.toISOString();
    };

    const handleSave = async () => {
        if (!letterText.trim()) return;
        const unlockAt = getUnlockDate();
        if (!unlockAt) return;

        setSaving(true);
        try {
            const res = await fetch('/api/letters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    letter_text: letterText,
                    unlock_at: unlockAt,
                    mood_when_written: currentMood,
                    tags: [],
                }),
            });

            if (res.ok) {
                setLetterText('');
                setViewMode('list');
                await fetchLetters();
            }
        } catch (err) {
            console.error('Failed to save letter:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleRead = async (letter: Letter) => {
        setSelectedLetter(letter);
        setViewMode('read');

        if (!letter.is_read) {
            await fetch('/api/letters', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: letter.id }),
            });
            fetchLetters();
        }
    };

    const handleDelete = async (id: string) => {
        const res = await fetch(`/api/letters?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            setSelectedLetter(null);
            setViewMode('list');
            await fetchLetters();
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const unlockedLetters = letters.filter(l => l.is_unlocked);
    const lockedLetters = letters.filter(l => !l.is_unlocked);

    // ----- Write View -----
    if (viewMode === 'write') {
        return (
            <div className="ltf-container">
                <div className="ltf-header">
                    <button onClick={() => setViewMode('list')} className="ltf-back-btn">← Back</button>
                    <h2>Write to Your Future Self</h2>
                </div>

                <div className="ltf-write-card">
                    <p className="ltf-write-prompt">
                        What do you want your future self to know? Share what you're feeling right now,
                        what you're struggling with, what you hope for. This letter will be sealed and
                        time-locked until the date you choose.
                    </p>

                    <textarea
                        value={letterText}
                        onChange={(e) => setLetterText(e.target.value)}
                        placeholder="Dear future me..."
                        className="ltf-textarea"
                        rows={10}
                    />

                    <div className="ltf-options">
                        <div className="ltf-option-group">
                            <label className="ltf-label">Open this letter in:</label>
                            <div className="ltf-time-options">
                                {[
                                    { key: '1m', label: '1 Month' },
                                    { key: '3m', label: '3 Months' },
                                    { key: '6m', label: '6 Months' },
                                    { key: '1y', label: '1 Year' },
                                    { key: 'custom', label: 'Custom' },
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setUnlockOption(opt.key as typeof unlockOption)}
                                        className={`ltf-time-btn ${unlockOption === opt.key ? 'active' : ''}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {unlockOption === 'custom' && (
                                <input
                                    type="date"
                                    value={customDate}
                                    onChange={(e) => setCustomDate(e.target.value)}
                                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                                    className="ltf-date-input"
                                />
                            )}
                        </div>

                        <div className="ltf-option-group">
                            <label className="ltf-label">Current mood: {currentMood}/10</label>
                            <input
                                type="range"
                                min={1}
                                max={10}
                                value={currentMood}
                                onChange={(e) => setCurrentMood(parseInt(e.target.value))}
                                className="ltf-mood-slider"
                            />
                            <div className="ltf-mood-labels">
                                <span>Terrible</span>
                                <span>Great</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={!letterText.trim() || saving}
                        className="ltf-seal-btn"
                    >
                        {saving ? 'Sealing...' : '🔒 Seal & Time-Lock This Letter'}
                    </button>
                </div>
            </div>
        );
    }

    // ----- Read View -----
    if (viewMode === 'read' && selectedLetter) {
        return (
            <div className="ltf-container">
                <div className="ltf-header">
                    <button onClick={() => { setSelectedLetter(null); setViewMode('list'); }} className="ltf-back-btn">← Back</button>
                    <h2>Letter from the Past</h2>
                </div>

                <div className="ltf-read-card">
                    <div className="ltf-read-meta">
                        <span className="ltf-read-date">Written on {formatDate(selectedLetter.written_at)}</span>
                        {selectedLetter.mood_when_written && (
                            <span className="ltf-read-mood">Mood: {selectedLetter.mood_when_written}/10</span>
                        )}
                    </div>

                    {selectedLetter.context_summary && (
                        <div className="ltf-context">
                            <p>{selectedLetter.context_summary}</p>
                        </div>
                    )}

                    <div className="ltf-letter-body">
                        {selectedLetter.letter_text?.split('\n').map((line, i) => (
                            <p key={i}>{line || <br />}</p>
                        ))}
                    </div>

                    <div className="ltf-read-actions">
                        <button onClick={() => handleDelete(selectedLetter.id)} className="ltf-delete-btn">
                            Delete Letter
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ----- List View -----
    return (
        <div className="ltf-container">
            <div className="ltf-header">
                <div>
                    <h2>Letters to Future Self</h2>
                    <p className="ltf-subtitle">Write now. Read later. Time-locked reflections.</p>
                </div>
                <button onClick={() => setViewMode('write')} className="ltf-write-btn">
                    ✍️ Write a Letter
                </button>
            </div>

            {loading ? (
                <div className="ltf-loading">Loading your letters...</div>
            ) : letters.length === 0 ? (
                <div className="ltf-empty">
                    <div className="ltf-empty-icon">✉️</div>
                    <h3>No letters yet</h3>
                    <p>Write a letter to your future self. It'll be sealed and time-locked until the date you choose.</p>
                    <button onClick={() => setViewMode('write')} className="ltf-write-btn">
                        Write Your First Letter
                    </button>
                </div>
            ) : (
                <div className="ltf-sections">
                    {/* Unlocked Letters */}
                    {unlockedLetters.length > 0 && (
                        <div className="ltf-section">
                            <h3 className="ltf-section-title">
                                🔓 Unlocked ({unlockedLetters.length})
                            </h3>
                            <div className="ltf-cards">
                                {unlockedLetters.map(letter => (
                                    <div
                                        key={letter.id}
                                        className={`ltf-card unlocked ${letter.is_read ? 'read' : 'unread'}`}
                                        onClick={() => handleRead(letter)}
                                    >
                                        {!letter.is_read && <div className="ltf-unread-badge">NEW</div>}
                                        <div className="ltf-card-date">
                                            Written {formatDate(letter.written_at)}
                                        </div>
                                        <div className="ltf-card-preview">
                                            {letter.letter_text?.substring(0, 80)}...
                                        </div>
                                        {letter.mood_when_written && (
                                            <div className="ltf-card-mood">
                                                Mood then: {letter.mood_when_written}/10
                                            </div>
                                        )}
                                        <div className="ltf-card-action">Click to read →</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Locked Letters */}
                    {lockedLetters.length > 0 && (
                        <div className="ltf-section">
                            <h3 className="ltf-section-title">
                                🔒 Sealed ({lockedLetters.length})
                            </h3>
                            <div className="ltf-cards">
                                {lockedLetters.map(letter => (
                                    <div key={letter.id} className="ltf-card locked">
                                        <div className="ltf-lock-icon">🔒</div>
                                        <div className="ltf-card-date">
                                            Written {formatDate(letter.written_at)}
                                        </div>
                                        <div className="ltf-card-locked-msg">
                                            {letter.days_until_unlock === 1
                                                ? 'Opens tomorrow!'
                                                : `Opens in ${letter.days_until_unlock} days`}
                                        </div>
                                        <div className="ltf-card-unlock-date">
                                            Unlocks {formatDate(letter.unlock_at)}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(letter.id); }}
                                            className="ltf-card-delete"
                                            title="Delete"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
