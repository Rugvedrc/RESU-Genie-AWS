import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResume } from '../context/ResumeContext'
import { History, BarChart3, MessageSquare, User, TrendingUp, RefreshCw } from 'lucide-react'
import axios from 'axios'

function ScoreBadge({ score }) {
    const color = score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 55 ? '#f59e0b' : '#ef4444'
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, height: 44, borderRadius: '50%',
            background: `${color}15`, border: `2px solid ${color}50`,
            fontWeight: 800, fontSize: 14, color
        }}>
            {score}
        </div>
    )
}

export default function HistoryPage() {
    const navigate = useNavigate()
    const { setResumeData } = useResume()
    const [resumes, setResumes] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchResumes = async () => {
        setLoading(true)
        try {
            const response = await axios.get('/api/resumes')
            setResumes(response.data.resumes || [])
        } catch {
            setResumes([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchResumes() }, [])

    const levelColors = {
        'Junior Engineer': '#10b981',
        'Mid-Level Engineer': '#3b82f6',
        'Senior Engineer': '#8b5cf6',
        'Staff Engineer': '#f59e0b',
    }

    return (
        <div style={{ minHeight: '100vh', padding: '90px 24px 60px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
                <div>
                    <div className="section-title">HISTORY</div>
                    <h1 style={{ fontSize: 40, fontWeight: 900 }}>
                        Resume <span className="gradient-text">Vault</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                        All analyzed resumes
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" onClick={fetchResumes}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/upload')}>
                        + Analyze New Resume
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="glass-card shimmer" style={{ height: 160, borderRadius: 16 }} />
                    ))}
                </div>
            ) : resumes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 24px' }}>
                    <History size={64} color="rgba(59,130,246,0.3)" style={{ margin: '0 auto 20px' }} />
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 10 }}>No Resumes Yet</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Upload your first resume to see it here</p>
                    <button className="btn-primary" onClick={() => navigate('/upload')}>Upload Resume</button>
                </div>
            ) : (
                <>
                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                        {[
                            { label: 'Total Resumes', value: resumes.length, color: '#3b82f6' },
                            { label: 'Avg Score', value: Math.round(resumes.reduce((s, r) => s + r.overall_score, 0) / resumes.length), color: '#10b981' },
                            { label: 'Top Score', value: Math.max(...resumes.map(r => r.overall_score)), color: '#f59e0b' },
                            { label: 'Score ≥ 85', value: resumes.filter(r => r.overall_score >= 85).length, color: '#8b5cf6' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className="glass-card" style={{ padding: '20px 24px', textAlign: 'center' }}>
                                <div style={{ fontSize: 32, fontWeight: 900, color, marginBottom: 4 }}>{value}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Resumes Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                        {resumes.map((resume, i) => {
                            const levelColor = levelColors[resume.career_level] || '#3b82f6'
                            return (
                                <div
                                    key={resume.resume_id}
                                    className="glass-card glass-card-hover"
                                    style={{ padding: '24px', cursor: 'pointer' }}
                                    onClick={() => {
                                        setResumeData(resume)
                                        navigate('/analysis')
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: `${levelColor}15`, border: `1px solid ${levelColor}30`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <User size={20} color={levelColor} />
                                        </div>
                                        <ScoreBadge score={resume.overall_score} />
                                    </div>

                                    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{resume.name || resume.filename}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{resume.filename}</div>

                                    {resume.career_level && (
                                        <span style={{
                                            display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                                            background: `${levelColor}15`, color: levelColor, border: `1px solid ${levelColor}30`, marginBottom: 16
                                        }}>
                                            {resume.career_level}
                                        </span>
                                    )}

                                    {/* Mini score bar */}
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                            <span>Overall Score</span>
                                            <span>{resume.overall_score}/100</span>
                                        </div>
                                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                            <div style={{
                                                height: '100%', borderRadius: 2,
                                                background: resume.overall_score >= 85 ? '#10b981' : resume.overall_score >= 70 ? '#3b82f6' : '#f59e0b',
                                                width: `${resume.overall_score}%`, transition: 'width 1s ease'
                                            }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                        <button
                                            className="btn-ghost"
                                            style={{ padding: '6px 12px', fontSize: 12 }}
                                            onClick={e => { e.stopPropagation(); setResumeData(resume); navigate('/chat') }}
                                        >
                                            <MessageSquare size={13} /> Chat
                                        </button>
                                        <button
                                            className="btn-primary"
                                            style={{ padding: '6px 12px', fontSize: 12 }}
                                            onClick={() => { setResumeData(resume); navigate('/analysis') }}
                                        >
                                            <BarChart3 size={13} /> View
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}
