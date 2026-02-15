'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key.trim() }),
            });

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                setError('Wrong key. Try again.');
            }
        } catch {
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo-area">
                    <span className="login-lock">🔒</span>
                    <h1 className="login-title">Inner Self</h1>
                    <p className="login-subtitle">Enter your secret key to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Secret key..."
                        className="login-input"
                        autoFocus
                        required
                    />

                    {error && <p className="login-error">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !key.trim()}
                        className="login-button"
                    >
                        {loading ? 'Verifying...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
}
