'use client';

import React, { useState, useEffect, useRef } from 'react';

// Color palette for charts
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

interface MetricPoint {
    date: string;
    value: number;
    unit: string;
    id: string;
}

interface UploadStatus {
    loading: boolean;
    message: string;
    error?: string;
}

// ---- Simple Sparkline Component (SVG) ----
const Sparkline = ({ data, color, name }: { data: MetricPoint[], color: string, name: string }) => {
    if (!data || data.length < 2) return <div className="health-no-data">Not enough data to graph</div>;

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 300;
    const height = 100;
    const padding = 10;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
        const y = height - padding - ((d.value - min) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="health-sparkline-card">
            <div className="health-sparkline-header">
                <h4 className="health-metric-name">{name}</h4>
                <div className="health-metric-value">
                    {data[data.length - 1].value} <span className="health-metric-unit">{data[0].unit}</span>
                </div>
            </div>
            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    points={points}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {data.map((d, i) => {
                    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
                    const y = height - padding - ((d.value - min) / range) * (height - 2 * padding);
                    return (
                        <circle cx={x} cy={y} r="4" fill={color} key={i}>
                            <title>{d.date}: {d.value} {d.unit}</title>
                        </circle>
                    );
                })}
            </svg>
            <div className="health-sparkline-dates">
                <span>{data[0].date}</span>
                <span>{data[data.length - 1].date}</span>
            </div>
        </div>
    );
};

// ---- Main Dashboard ----
export default function HealthDashboard() {
    const [metrics, setMetrics] = useState<Record<string, MetricPoint[]>>({});
    const [status, setStatus] = useState<UploadStatus>({ loading: false, message: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch metrics
    const fetchMetrics = async () => {
        try {
            const res = await fetch('/api/health/metrics');
            const json = await res.json();
            if (json.success) {
                setMetrics(json.grouped_metrics || {});
            }
        } catch (e) {
            console.error('Failed to fetch metrics', e);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    // Handle File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus({ loading: true, message: 'Uploading report...' });

        try {
            const formData = new FormData();
            formData.append('file', file);

            // 1. Upload
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadJson = await uploadRes.json();

            if (!uploadJson.success) throw new Error(uploadJson.error || 'Upload failed');

            setStatus({ loading: true, message: 'Analyzing with AI (this takes 10-20s)...' });

            // 2. Process
            const processRes = await fetch('/api/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId: uploadJson.docId }),
            });
            const processJson = await processRes.json();

            if (processJson.error) throw new Error(processJson.error);

            setStatus({ loading: false, message: 'Checkup complete! New metrics added.' });

            // Refresh
            fetchMetrics();

        } catch (error: any) {
            setStatus({ loading: false, message: '', error: error.message });
        }
    };

    return (
        <div className="health-dashboard">
            <div className="health-header">
                <h2 className="health-title">Health & Vitals</h2>
                <button
                    className="health-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                >
                    + Upload Report
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileUpload}
                    />
                </button>
            </div>

            {/* Status Message */}
            {(status.loading || status.message || status.error) && (
                <div className={`health-status ${status.error ? 'error' : ''}`}>
                    {status.loading && <span className="loading-spinner" />}
                    <span>{status.message}</span>
                    {status.error && <strong>Error: {status.error}</strong>}
                </div>
            )}

            {/* Charts Grid */}
            <div className="health-grid">
                {Object.keys(metrics).length === 0 ? (
                    <div className="health-empty">
                        <span className="empty-icon">🩺</span>
                        <h3>No health data yet.</h3>
                        <p>Upload a medical report (PDF/Image) to see your vitals here.</p>
                    </div>
                ) : (
                    Object.entries(metrics).map(([name, data], i) => (
                        <Sparkline
                            key={name}
                            name={name}
                            data={data}
                            color={COLORS[i % COLORS.length]}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
