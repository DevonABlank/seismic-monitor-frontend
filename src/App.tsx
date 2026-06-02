import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'

const API = 'http://localhost:8080/api'

interface SeismicEvent {
    id: number
    usgsId: string
    place: string
    magnitude: number | null
    depth: number | null
    latitude: number | null
    longitude: number | null
    alert: string | null
    tsunami: boolean
    significance: number
    eventTime: string
}

interface Page {
    content: SeismicEvent[]
    totalElements: number
    totalPages: number
    number: number
}

const magClass = (m: number | null) => {
    if (!m) return 'mag-low'
    if (m >= 5) return 'mag-high'
    if (m >= 3) return 'mag-med'
    return 'mag-low'
}

const alertBadge = (alert: string | null, tsunami: boolean) => {
    if (alert === 'red') return <span className="badge badge-red">Red</span>
    if (alert === 'yellow') return <span className="badge badge-yellow">Yellow</span>
    if (alert === 'green') return <span className="badge badge-green">Green</span>
    if (tsunami) return <span className="badge badge-yellow">Tsunami</span>
    return <span className="badge badge-gray">—</span>
}

const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function App() {
    const [page, setPage] = useState<Page | null>(null)
    const [currentPage, setCurrentPage] = useState(0)
    const [minMag, setMinMag] = useState<number | null>(null)
    const [totalCount, setTotalCount] = useState(0)
    const [lastSync, setLastSync] = useState('')

    const fetchData = useCallback(async () => {
        const params: Record<string, unknown> = { page: currentPage, size: 20 }
        if (minMag !== null) params.minMagnitude = minMag
        const [eventsRes, countRes] = await Promise.all([
            axios.get(`${API}/events`, { params }),
            axios.get(`${API}/events/count`)
        ])
        setPage(eventsRes.data)
        setTotalCount(countRes.data)
        setLastSync(new Date().toLocaleTimeString())
    }, [currentPage, minMag])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 60000)
        return () => clearInterval(interval)
    }, [fetchData])

    const events = page?.content ?? []
    const significant = events.filter(e => e.magnitude && e.magnitude >= 5).length
    const maxMag = events.reduce((max, e) => Math.max(max, e.magnitude ?? 0), 0)
    const tsunamiCount = events.filter(e => e.tsunami).length

    const magBuckets = [
        { label: 'M 5+', count: events.filter(e => (e.magnitude ?? 0) >= 5).length, color: '#f87171', max: 5 },
        { label: 'M 3-5', count: events.filter(e => (e.magnitude ?? 0) >= 3 && (e.magnitude ?? 0) < 5).length, color: '#fbbf24', max: 5 },
        { label: 'M 1-3', count: events.filter(e => (e.magnitude ?? 0) >= 1 && (e.magnitude ?? 0) < 3).length, color: '#4ade80', max: 20 },
        { label: 'M <1', count: events.filter(e => (e.magnitude ?? 0) < 1).length, color: '#3b82f6', max: 10 },
    ]

    return (
        <div>
            <div className="topbar">
                <span className="topbar-title">⬡ Global Seismic Monitor</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="live-badge">
                        <div className="live-dot" />
                        Live — auto-refresh 60s
                    </div>
                    <span style={{ fontSize: 11, color: '#475569' }}>Last sync: {lastSync}</span>
                </div>
            </div>

            <div className="metrics">
                <div className="metric-card">
                    <div className="metric-label">Total events (DB)</div>
                    <div className="metric-value">{totalCount.toLocaleString()}</div>
                    <div className="metric-sub">All recorded events</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Significant (M 5.0+)</div>
                    <div className={`metric-value ${significant > 0 ? 'warn' : 'ok'}`}>{significant}</div>
                    <div className="metric-sub">Current page</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Max magnitude</div>
                    <div className={`metric-value ${maxMag >= 5 ? 'danger' : maxMag >= 3 ? 'warn' : 'ok'}`}>
                        {maxMag.toFixed(1)}
                    </div>
                    <div className="metric-sub">Current page</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Tsunami alerts</div>
                    <div className={`metric-value ${tsunamiCount > 0 ? 'danger' : 'ok'}`}>{tsunamiCount}</div>
                    <div className="metric-sub">{tsunamiCount === 0 ? 'All clear' : 'Active alerts'}</div>
                </div>
            </div>

            <div className="main-layout">
                <div className="panel">
                    <div className="panel-header">
                        <span className="panel-title">Recent events</span>
                        <div className="filters">
                            {[null, 2, 3, 4, 5].map(m => (
                                <button
                                    key={m}
                                    className={`filter-btn ${minMag === m ? 'active' : ''}`}
                                    onClick={() => { setMinMag(m); setCurrentPage(0) }}
                                >
                                    {m === null ? 'All' : `M ${m}+`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {!page ? (
                        <div className="loading">Loading...</div>
                    ) : (
                        <>
                            <table>
                                <thead>
                                <tr>
                                    <th style={{ width: '35%' }}>Location</th>
                                    <th style={{ width: '12%' }}>Magnitude</th>
                                    <th style={{ width: '12%' }}>Depth (km)</th>
                                    <th style={{ width: '12%' }}>Significance</th>
                                    <th style={{ width: '16%' }}>Time (UTC)</th>
                                    <th style={{ width: '13%' }}>Alert</th>
                                </tr>
                                </thead>
                                <tbody>
                                {events.map(e => (
                                    <tr key={e.id}>
                                        <td>{e.place}</td>
                                        <td className={magClass(e.magnitude)}>
                                            {e.magnitude?.toFixed(1) ?? '—'}
                                        </td>
                                        <td>{e.depth?.toFixed(1) ?? '—'}</td>
                                        <td>{e.significance}</td>
                                        <td style={{ color: '#475569' }}>{formatTime(e.eventTime)}</td>
                                        <td>{alertBadge(e.alert, e.tsunami)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            <div className="pagination">
                                <span>Showing {currentPage * 20 + 1}–{Math.min((currentPage + 1) * 20, page.totalElements)} of {page.totalElements.toLocaleString()} events</span>
                                <div className="pg-btns">
                                    <button className="pg-btn" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>← Prev</button>
                                    {Array.from({ length: Math.min(5, page.totalPages) }, (_, i) => (
                                        <button key={i} className={`pg-btn ${currentPage === i ? 'active' : ''}`} onClick={() => setCurrentPage(i)}>{i + 1}</button>
                                    ))}
                                    <button className="pg-btn" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= page.totalPages - 1}>Next →</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="sidebar">
                    <div className="panel">
                        <div className="panel-header">
                            <span className="panel-title">Magnitude breakdown</span>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                            {magBuckets.map(b => (
                                <div className="bar-row" key={b.label}>
                                    <span className="bar-label">{b.label}</span>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: `${Math.min(100, (b.count / b.max) * 100)}%`, background: b.color }} />
                                    </div>
                                    <span className="bar-count">{b.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <span className="panel-title">Active alerts</span>
                        </div>
                        <div style={{ padding: '10px 14px' }}>
                            {events.filter(e => e.alert || e.tsunami).length === 0 ? (
                                <div style={{ color: '#4ade80', fontSize: 12, padding: '8px 0' }}>✓ No active alerts</div>
                            ) : (
                                events.filter(e => e.alert || e.tsunami).slice(0, 5).map(e => (
                                    <div key={e.id} style={{ borderBottom: '1px solid #1e2d45', padding: '8px 0', fontSize: 12 }}>
                                        <div style={{ color: '#f87171', marginBottom: 2 }}>M{e.magnitude?.toFixed(1)} — {e.place}</div>
                                        <div style={{ color: '#475569', fontSize: 11 }}>{formatTime(e.eventTime)} UTC</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <span className="panel-title">System status</span>
                        </div>
                        <div style={{ padding: '10px 14px' }}>
                            {[
                                { label: 'API', status: 'Online', ok: true },
                                { label: 'Database', status: 'Connected', ok: true },
                                { label: 'USGS Feed', status: 'Active', ok: true },
                                { label: 'Refresh', status: '60s interval', ok: true },
                            ].map(s => (
                                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #111827', fontSize: 12 }}>
                                    <span style={{ color: '#64748b' }}>{s.label}</span>
                                    <span style={{ color: s.ok ? '#4ade80' : '#f87171' }}>{s.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}