'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ──────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────
interface MetricPoint {
    date: string;
    value: number;
    unit: string;
    status?: string;
    id: string;
    source_doc_id?: string;
}

interface UploadStatus {
    loading: boolean;
    message: string;
    error?: string;
}

interface ReferenceRange {
    low: number;
    high: number;
    unit: string;
    criticalLow?: number;
    criticalHigh?: number;
}

interface MetricGroup {
    key: string;
    label: string;
    icon: string;
    color: string;
    gradient: string;
    metrics: string[];   // metric names that belong here
}

// ──────────────────────────────────────────────────
// REFERENCE RANGES (common lab values)
// ──────────────────────────────────────────────────
const REFERENCE_RANGES: Record<string, ReferenceRange> = {
    'glucose - fasting': { low: 70, high: 100, unit: 'mg/dL', criticalLow: 54, criticalHigh: 126 },
    'glucose fasting': { low: 70, high: 100, unit: 'mg/dL', criticalLow: 54, criticalHigh: 126 },
    'fasting glucose': { low: 70, high: 100, unit: 'mg/dL', criticalLow: 54, criticalHigh: 126 },
    'hemoglobin a1c': { low: 4.0, high: 5.6, unit: '%', criticalHigh: 6.5 },
    'hba1c': { low: 4.0, high: 5.6, unit: '%', criticalHigh: 6.5 },
    'cholesterol - total': { low: 0, high: 200, unit: 'mg/dL', criticalHigh: 240 },
    'total cholesterol': { low: 0, high: 200, unit: 'mg/dL', criticalHigh: 240 },
    'cholesterol - hdl': { low: 40, high: 60, unit: 'mg/dL', criticalLow: 35 },
    'hdl cholesterol': { low: 40, high: 60, unit: 'mg/dL', criticalLow: 35 },
    'cholesterol - ldl': { low: 0, high: 100, unit: 'mg/dL', criticalHigh: 160 },
    'ldl cholesterol': { low: 0, high: 100, unit: 'mg/dL', criticalHigh: 160 },
    'triglycerides': { low: 0, high: 150, unit: 'mg/dL', criticalHigh: 200 },
    'hemoglobin': { low: 13.5, high: 17.5, unit: 'g/dL', criticalLow: 10, criticalHigh: 20 },
    'hematocrit': { low: 38.3, high: 48.6, unit: '%', criticalLow: 30 },
    'rbc count': { low: 4.5, high: 5.5, unit: 'M/uL', criticalLow: 3.5 },
    'platelet count': { low: 1.5, high: 4.0, unit: 'Lakhs/cumm', criticalLow: 1.0, criticalHigh: 4.5 },
    'wbc count': { low: 4000, high: 11000, unit: 'cells/mcL', criticalLow: 2000, criticalHigh: 15000 },
    'absolute lymphocyte count': { low: 1000, high: 3000, unit: '/cumm', criticalHigh: 4000 },
    'esr': { low: 0, high: 15, unit: 'mm', criticalHigh: 30 },
    'alt/sgpt': { low: 7, high: 56, unit: 'IU/L', criticalHigh: 80 },
    'ast/sgot': { low: 10, high: 40, unit: 'IU/L', criticalHigh: 80 },
    'alkaline phosphatase': { low: 44, high: 147, unit: 'IU/L', criticalHigh: 200 },
    'bilirubin total': { low: 0.1, high: 1.2, unit: 'mg/dL', criticalHigh: 2.0 },
    'creatinine - serum': { low: 0.7, high: 1.3, unit: 'mg/dL', criticalHigh: 1.8 },
    'serum creatinine': { low: 0.7, high: 1.3, unit: 'mg/dL', criticalHigh: 1.8 },
    'calcium - serum': { low: 8.5, high: 10.5, unit: 'mg/dL', criticalLow: 7.5, criticalHigh: 11.5 },
    'serum calcium': { low: 8.5, high: 10.5, unit: 'mg/dL', criticalLow: 7.5, criticalHigh: 11.5 },
    'urea': { low: 7, high: 20, unit: 'mg/dL', criticalHigh: 40 },
    'uric acid': { low: 3.5, high: 7.2, unit: 'mg/dL', criticalHigh: 9.0 },
    'tsh': { low: 0.4, high: 4.0, unit: 'mIU/L', criticalHigh: 10 },
    'vitamin d': { low: 30, high: 100, unit: 'ng/mL', criticalLow: 20 },
    'vitamin b12': { low: 200, high: 900, unit: 'pg/mL', criticalLow: 150 },
    'iron': { low: 60, high: 170, unit: 'mcg/dL', criticalLow: 30 },
    'ferritin': { low: 20, high: 250, unit: 'ng/mL', criticalLow: 10 },
    'sodium': { low: 136, high: 145, unit: 'mEq/L', criticalLow: 130, criticalHigh: 150 },
    'potassium': { low: 3.5, high: 5.0, unit: 'mEq/L', criticalLow: 3.0, criticalHigh: 5.5 },
};

function findRange(metricName: string): ReferenceRange | null {
    const key = metricName.toLowerCase().trim();
    if (REFERENCE_RANGES[key]) return REFERENCE_RANGES[key];
    // Fuzzy match
    for (const [k, v] of Object.entries(REFERENCE_RANGES)) {
        if (key.includes(k) || k.includes(key)) return v;
    }
    return null;
}

// ──────────────────────────────────────────────────
// METRIC GROUPING — which body system does each metric belong to?
// ──────────────────────────────────────────────────
const METRIC_GROUPS: MetricGroup[] = [
    {
        key: 'lipid',
        label: 'Lipid Panel',
        icon: '🫀',
        color: '#EF4444',
        gradient: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.03))',
        metrics: ['cholesterol', 'triglycerides', 'hdl', 'ldl', 'vldl'],
    },
    {
        key: 'metabolic',
        label: 'Metabolic & Sugar',
        icon: '🔬',
        color: '#F59E0B',
        gradient: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.03))',
        metrics: ['glucose', 'hba1c', 'hemoglobin a1c', 'insulin', 'calcium', 'sodium', 'potassium', 'urea', 'uric acid', 'creatinine'],
    },
    {
        key: 'liver',
        label: 'Liver Function',
        icon: '🧬',
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.03))',
        metrics: ['alt', 'sgpt', 'ast', 'sgot', 'alkaline phosphatase', 'bilirubin', 'albumin', 'globulin', 'protein'],
    },
    {
        key: 'blood',
        label: 'Blood Count (CBC)',
        icon: '🩸',
        color: '#EC4899',
        gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(236,72,153,0.03))',
        metrics: ['hemoglobin', 'hematocrit', 'rbc', 'platelet', 'wbc', 'lymphocyte', 'neutrophil', 'eosinophil', 'basophil', 'monocyte', 'mcv', 'mch', 'mchc', 'rdw', 'esr', 'mpv'],
    },
    {
        key: 'thyroid',
        label: 'Thyroid & Hormones',
        icon: '🦋',
        color: '#06B6D4',
        gradient: 'linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.03))',
        metrics: ['tsh', 't3', 't4', 'thyroid', 'testosterone', 'cortisol', 'dhea'],
    },
    {
        key: 'vitamins',
        label: 'Vitamins & Minerals',
        icon: '💊',
        color: '#10B981',
        gradient: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.03))',
        metrics: ['vitamin', 'iron', 'ferritin', 'zinc', 'magnesium', 'folate', 'folic'],
    },
];

function classifyMetric(name: string): string {
    const lower = name.toLowerCase();
    for (const group of METRIC_GROUPS) {
        if (group.metrics.some(keyword => lower.includes(keyword))) {
            return group.key;
        }
    }
    return 'other';
}

// ──────────────────────────────────────────────────
// HELPER: determine visual status from value + range
// ──────────────────────────────────────────────────
function getComputedStatus(value: number, range: ReferenceRange | null, rawStatus?: string): 'normal' | 'high' | 'low' | 'critical' {
    if (range) {
        if (range.criticalHigh && value >= range.criticalHigh) return 'critical';
        if (range.criticalLow && value <= range.criticalLow) return 'critical';
        if (value > range.high) return 'high';
        if (value < range.low) return 'low';
        return 'normal';
    }
    // Fall back to AI-provided status
    const s = (rawStatus || 'normal').toLowerCase();
    if (s === 'high' || s === 'low') return s;
    return 'normal';
}

const STATUS_COLORS = {
    normal: { bg: 'rgba(16,185,129,0.12)', text: '#10B981', label: 'Normal' },
    high: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444', label: 'High' },
    low: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', label: 'Low' },
    critical: { bg: 'rgba(239,68,68,0.25)', text: '#DC2626', label: 'Critical' },
};

// ──────────────────────────────────────────────────
// RANGE BAR — shows where value sits relative to normal
// ──────────────────────────────────────────────────
function RangeBar({ value, range, status }: { value: number; range: ReferenceRange | null; status: 'normal' | 'high' | 'low' | 'critical' }) {
    if (!range) {
        // No range data — show a simple colored dot
        return (
            <div className="hd-range-bar-wrap">
                <div className="hd-range-bar">
                    <div className="hd-range-fill" style={{ width: '50%', background: STATUS_COLORS[status].text }} />
                </div>
            </div>
        );
    }

    // Calculate position as percentage (allow overshoot)
    const fullMin = range.criticalLow ?? range.low * 0.6;
    const fullMax = range.criticalHigh ?? range.high * 1.5;
    const fullRange = fullMax - fullMin || 1;
    const pct = Math.max(2, Math.min(98, ((value - fullMin) / fullRange) * 100));

    // Normal zone position
    const normalStart = ((range.low - fullMin) / fullRange) * 100;
    const normalEnd = ((range.high - fullMin) / fullRange) * 100;

    const dotColor = STATUS_COLORS[status].text;

    return (
        <div className="hd-range-bar-wrap">
            <div className="hd-range-bar">
                {/* Gray background track */}
                <div className="hd-range-track" />
                {/* Green normal zone */}
                <div
                    className="hd-range-normal"
                    style={{ left: `${normalStart}%`, width: `${normalEnd - normalStart}%` }}
                />
                {/* Value dot */}
                <div
                    className="hd-range-dot"
                    style={{ left: `${pct}%`, background: dotColor, boxShadow: `0 0 8px ${dotColor}55` }}
                />
            </div>
            <div className="hd-range-labels">
                <span>{range.low}</span>
                <span>{range.high}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// RADIAL GAUGE — overall health score
// ──────────────────────────────────────────────────
function RadialGauge({ score, total, label }: { score: number; total: number; label: string }) {
    const pct = total === 0 ? 0 : Math.round((score / total) * 100);
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

    return (
        <div className="hd-gauge">
            <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle
                    cx="65" cy="65" r={radius}
                    fill="none" stroke={color} strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 65 65)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
            </svg>
            <div className="hd-gauge-text">
                <span className="hd-gauge-pct" style={{ color }}>{pct}%</span>
                <span className="hd-gauge-label">{label}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// SINGLE METRIC CARD
// ──────────────────────────────────────────────────
function MetricCard({
    name,
    data,
    groupColor,
    onDelete,
}: {
    name: string;
    data: MetricPoint[];
    groupColor: string;
    onDelete: (id: string, name: string) => void;
}) {
    const latest = data[data.length - 1];
    const range = findRange(name);
    const status = getComputedStatus(latest.value, range, latest.status);
    const sc = STATUS_COLORS[status];

    return (
        <div className={`hd-metric-card hd-status-${status}`}>
            <div className="hd-metric-top">
                <div className="hd-metric-info">
                    <span className="hd-metric-name">{name}</span>
                    <span className="hd-metric-date">{latest.date}</span>
                </div>
                <button
                    className="hd-metric-x"
                    onClick={() => onDelete(latest.id, name)}
                    title="Delete"
                >
                    &times;
                </button>
            </div>
            <div className="hd-metric-val-row">
                <span className="hd-metric-val" style={{ color: sc.text }}>
                    {latest.value}
                </span>
                <span className="hd-metric-unit">{latest.unit || ''}</span>
                <span className="hd-metric-badge" style={{ background: sc.bg, color: sc.text }}>
                    {sc.label}
                </span>
            </div>
            <RangeBar value={latest.value} range={range} status={status} />
            {/* Mini sparkline for multi-value metrics */}
            {data.length > 1 && (
                <MiniSparkline data={data} color={groupColor} />
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────
// MINI SPARKLINE (for metrics with multiple readings)
// ──────────────────────────────────────────────────
function MiniSparkline({ data, color }: { data: MetricPoint[]; color: string }) {
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 200, h = 36, p = 4;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (w - 2 * p) + p;
        const y = h - p - ((d.value - min) / range) * (h - 2 * p);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="hd-mini-spark">
            <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                <defs>
                    <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
                {/* Area fill */}
                <polygon
                    fill={`url(#sg-${color.replace('#', '')})`}
                    points={`${p},${h} ${points} ${w - p},${h}`}
                />
            </svg>
            <div className="hd-mini-spark-range">
                <span>{data[0].date}</span>
                <span>{data[data.length - 1].date}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// BODY SYSTEM PANEL — grouped panel for one organ system
// ──────────────────────────────────────────────────
function SystemPanel({
    group,
    metricsInGroup,
    onDelete,
}: {
    group: MetricGroup;
    metricsInGroup: [string, MetricPoint[]][];
    onDelete: (id: string, name: string) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    // Compute stats
    let normalCount = 0;
    let abnormalCount = 0;
    metricsInGroup.forEach(([name, data]) => {
        const latest = data[data.length - 1];
        const range = findRange(name);
        const status = getComputedStatus(latest.value, range, latest.status);
        if (status === 'normal') normalCount++;
        else abnormalCount++;
    });
    const total = normalCount + abnormalCount;

    return (
        <div className="hd-system-panel" style={{ background: group.gradient }}>
            <div className="hd-system-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="hd-system-left">
                    <span className="hd-system-icon">{group.icon}</span>
                    <div>
                        <h3 className="hd-system-title">{group.label}</h3>
                        <div className="hd-system-stats">
                            <span className="hd-stat-ok">{normalCount} normal</span>
                            {abnormalCount > 0 && (
                                <span className="hd-stat-warn">{abnormalCount} flagged</span>
                            )}
                            <span className="hd-stat-total">{total} tests</span>
                        </div>
                    </div>
                </div>
                <div className="hd-system-right">
                    {/* Mini health bar */}
                    <div className="hd-mini-health-bar">
                        <div
                            className="hd-mini-health-fill"
                            style={{
                                width: `${total > 0 ? (normalCount / total) * 100 : 0}%`,
                                background: normalCount === total ? '#10B981' : '#F59E0B',
                            }}
                        />
                    </div>
                    <span className={`hd-chevron ${collapsed ? '' : 'open'}`}>&#9662;</span>
                </div>
            </div>
            {!collapsed && (
                <div className="hd-system-grid">
                    {metricsInGroup.map(([name, data]) => (
                        <MetricCard
                            key={name}
                            name={name}
                            data={data}
                            groupColor={group.color}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════
export default function HealthDashboard() {
    const [metrics, setMetrics] = useState<Record<string, MetricPoint[]>>({});
    const [status, setStatus] = useState<UploadStatus>({ loading: false, message: '' });
    const [deleting, setDeleting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await fetch('/api/health/metrics');
            const json = await res.json();
            if (json.success) {
                setMetrics(json.grouped_metrics || {});
            }
        } catch (e) {
            console.error('Failed to fetch metrics', e);
        }
    }, []);

    useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

    // File upload handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setStatus({ loading: true, message: 'Uploading report...' });
        try {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
            const uploadJson = await uploadRes.json();
            if (!uploadJson.success) throw new Error(uploadJson.error || 'Upload failed');

            setStatus({ loading: true, message: 'Analyzing with AI (10-20s)...' });
            const processRes = await fetch('/api/process-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId: uploadJson.docId }),
            });
            const processJson = await processRes.json();
            if (processJson.error) throw new Error(processJson.error);

            setStatus({ loading: false, message: `Done! Found ${processJson.metricsFound || 0} metrics.` });
            fetchMetrics();
        } catch (error: any) {
            setStatus({ loading: false, message: '', error: error.message });
        }
    };

    const handleDeleteMetric = async (id: string, metricName: string) => {
        if (!confirm(`Delete this ${metricName} reading?`)) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/health/metrics?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) await fetchMetrics();
            else alert('Failed to delete: ' + (json.error || 'Unknown'));
        } catch (e) { console.error('Delete failed', e); }
        setDeleting(false);
    };

    const handleClearAll = async () => {
        if (!confirm('Delete ALL health data? This cannot be undone.')) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/health/metrics?all=true', { method: 'DELETE' });
            const json = await res.json();
            if (json.success) { setMetrics({}); setStatus({ loading: false, message: `Cleared ${json.deleted} metrics.` }); }
        } catch (e) { console.error('Clear all failed', e); }
        setDeleting(false);
    };

    // ── Group metrics by body system ──
    const grouped = useMemo(() => {
        const buckets: Record<string, [string, MetricPoint[]][]> = {};
        for (const [name, data] of Object.entries(metrics)) {
            const groupKey = classifyMetric(name);
            if (!buckets[groupKey]) buckets[groupKey] = [];
            buckets[groupKey].push([name, data]);
        }
        return buckets;
    }, [metrics]);

    // ── Overall stats ──
    const allEntries = Object.entries(metrics);
    const totalMetrics = allEntries.length;
    let normalTotal = 0;
    let abnormalTotal = 0;
    allEntries.forEach(([name, data]) => {
        const latest = data[data.length - 1];
        const range = findRange(name);
        const st = getComputedStatus(latest.value, range, latest.status);
        if (st === 'normal') normalTotal++;
        else abnormalTotal++;
    });

    // Collect latest dates
    const allDates = allEntries.map(([, data]) => data[data.length - 1].date).sort();
    const latestDate = allDates.length > 0 ? allDates[allDates.length - 1] : null;

    const isEmpty = totalMetrics === 0;

    return (
        <div className="hd-dashboard">
            {/* ─── Header ─── */}
            <div className="hd-header">
                <div>
                    <h2 className="hd-title">Health & Vitals</h2>
                    {latestDate && <span className="hd-subtitle">Last updated: {latestDate}</span>}
                </div>
                <div className="hd-header-actions">
                    {!isEmpty && (
                        <button className="hd-btn-danger" onClick={handleClearAll} disabled={deleting}>
                            Clear All
                        </button>
                    )}
                    <button className="hd-btn-primary" onClick={() => fileInputRef.current?.click()}>
                        Upload Report
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={handleFileUpload}
                        />
                    </button>
                </div>
            </div>

            {/* ─── Status ─── */}
            {(status.loading || status.message || status.error) && (
                <div className={`hd-status ${status.error ? 'error' : ''}`}>
                    {status.loading && <span className="loading-spinner" />}
                    <span>{status.message}</span>
                    {status.error && <strong>Error: {status.error}</strong>}
                </div>
            )}

            {isEmpty ? (
                <div className="hd-empty">
                    <div className="hd-empty-icon">🩺</div>
                    <h3>No health data yet</h3>
                    <p>Upload a lab report (PDF or image) to see your health vitals visualized here with reference ranges, trend lines, and body system grouping.</p>
                </div>
            ) : (
                <>
                    {/* ─── Hero Overview ─── */}
                    <div className="hd-overview">
                        <RadialGauge score={normalTotal} total={totalMetrics} label="In Range" />
                        <div className="hd-overview-stats">
                            <div className="hd-overview-row">
                                <div className="hd-ov-card hd-ov-normal">
                                    <span className="hd-ov-num">{normalTotal}</span>
                                    <span className="hd-ov-label">Normal</span>
                                </div>
                                <div className="hd-ov-card hd-ov-flagged">
                                    <span className="hd-ov-num">{abnormalTotal}</span>
                                    <span className="hd-ov-label">Flagged</span>
                                </div>
                                <div className="hd-ov-card hd-ov-total">
                                    <span className="hd-ov-num">{totalMetrics}</span>
                                    <span className="hd-ov-label">Total Tests</span>
                                </div>
                            </div>
                            {/* System chips */}
                            <div className="hd-system-chips">
                                {METRIC_GROUPS.filter(g => grouped[g.key]).map(g => {
                                    const count = grouped[g.key]?.length || 0;
                                    const norms = grouped[g.key]?.filter(([name, data]) => {
                                        const r = findRange(name);
                                        return getComputedStatus(data[data.length - 1].value, r, data[data.length - 1].status) === 'normal';
                                    }).length || 0;
                                    const allOk = norms === count;
                                    return (
                                        <span
                                            key={g.key}
                                            className={`hd-sys-chip ${allOk ? 'ok' : 'warn'}`}
                                            style={{ borderColor: allOk ? '#10B981' : '#F59E0B' }}
                                        >
                                            {g.icon} {g.label}
                                            <span className="hd-sys-chip-count">{norms}/{count}</span>
                                        </span>
                                    );
                                })}
                                {grouped['other'] && (
                                    <span className="hd-sys-chip ok" style={{ borderColor: '#6B7280' }}>
                                        📋 Other
                                        <span className="hd-sys-chip-count">{grouped['other'].length}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ─── Grouped Panels ─── */}
                    <div className="hd-panels">
                        {METRIC_GROUPS.filter(g => grouped[g.key]).map(g => (
                            <SystemPanel
                                key={g.key}
                                group={g}
                                metricsInGroup={grouped[g.key]}
                                onDelete={handleDeleteMetric}
                            />
                        ))}
                        {/* Other / uncategorized */}
                        {grouped['other'] && (
                            <SystemPanel
                                group={{
                                    key: 'other',
                                    label: 'Other Metrics',
                                    icon: '📋',
                                    color: '#6B7280',
                                    gradient: 'linear-gradient(135deg, rgba(107,114,128,0.12), rgba(107,114,128,0.03))',
                                    metrics: [],
                                }}
                                metricsInGroup={grouped['other']}
                                onDelete={handleDeleteMetric}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
