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
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logoArea}>
                    <span style={styles.lock}>🔒</span>
                    <h1 style={styles.title}>Inner Self</h1>
                    <p style={styles.subtitle}>Enter your secret key to continue</p>
                </div>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="Secret key..."
                        style={styles.input}
                        autoFocus
                        required
                    />

                    {error && <p style={styles.error}>{error}</p>}

                    <button
                        type="submit"
                        disabled={loading || !key.trim()}
                        style={{
                            ...styles.button,
                            opacity: loading || !key.trim() ? 0.5 : 1,
                        }}
                    >
                        {loading ? 'Verifying...' : 'Unlock'}
                    </button>
                </form>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        padding: '20px',
    },
    card: {
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '48px 40px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
    },
    logoArea: {
        textAlign: 'center' as const,
        marginBottom: '32px',
    },
    lock: {
        fontSize: '48px',
        display: 'block',
        marginBottom: '16px',
    },
    title: {
        fontSize: '28px',
        fontWeight: 700,
        color: '#ffffff',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px',
    },
    subtitle: {
        fontSize: '14px',
        color: 'rgba(255, 255, 255, 0.5)',
        margin: 0,
    },
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '16px',
    },
    input: {
        padding: '14px 18px',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: 'rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
        fontSize: '16px',
        outline: 'none',
        transition: 'border-color 0.2s',
    },
    error: {
        color: '#ff6b6b',
        fontSize: '13px',
        margin: 0,
        textAlign: 'center' as const,
    },
    button: {
        padding: '14px',
        borderRadius: '12px',
        border: 'none',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#ffffff',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'opacity 0.2s, transform 0.1s',
    },
};
