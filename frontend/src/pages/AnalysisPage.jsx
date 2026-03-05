import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useResume } from '../context/ResumeContext'
import {
    Chart as ChartJS,
    RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement, ArcElement
} from 'chart.js'
import { Radar, Bar, Doughnut } from 'react-chartjs-2'
import {
    Briefcase, GraduationCap, Code, Award, TrendingUp, MessageSquare,
    AlertTriangle, CheckCircle, Target, Star, ExternalLink, ArrowRight,
    MapPin, Mail, Phone, Linkedin, Github, Clock, ChevronDown, ChevronUp,
    Loader, Minus
} from 'lucide-react'

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
    CategoryScale, LinearScale, BarElement, ArcElement)

// ============================
// JD FIT INLINE PANEL
// ============================
function JDFitPanel({ resumeId }) {
    const [open, setOpen] = useState(false)
    const [jdText, setJdText] = useState('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState(null)

    const analyze = async () => {
        if (jdText.trim().split(/\s+/).length < 20) {
            setError('Please paste at least 20 words from the job description.')
            return
        }
        setLoading(true); setError(null); setResult(null)
        try {
            const res = await axios.post('/api/jd-fit', { jd_text: jdText.trim(), resume_id: resumeId })
            setResult(res.data)
        } catch (e) {
            setError(e.response?.data?.error || 'Analysis failed. Try again.')
        } finally {
            setLoading(false)
        }
    }

    const verdictCfg = {
        'Strong Fit': { color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.20)', icon: '✅', cta: 'You are well-positioned to apply. Go for it!' },
        'Good Fit': { color: '#4f6ef7', bg: 'rgba(79,110,247,0.08)', border: 'rgba(79,110,247,0.20)', icon: '👍', cta: 'You\'re a solid candidate. A few tailored tweaks could give you an edge.' },
        'Partial Fit': { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.20)', icon: '📝', cta: 'Tailor your resume to highlight the matching areas before applying.' },
        'Low Fit': { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.20)', icon: '⚠️', cta: 'There are significant gaps. Address missing skills before applying.' },
    }

    const vc = result ? (verdictCfg[result.verdict] || verdictCfg['Partial Fit']) : null

    return (
        <div style={{ marginBottom: 24 }}>
            {/* Toggle button */}
            <button
                onClick={() => { setOpen(o => !o); setResult(null); setError(null) }}
                style={{
                    width: '100%', padding: '16px 24px',
                    background: open ? 'var(--surface-2)' : 'var(--surface-1)',
                    border: `1px solid ${open ? 'var(--accent-border)' : 'var(--border-1)'}`,
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', transition: 'all 0.18s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Target size={18} color="var(--accent)" />
                    <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Check Fit for a Job</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Paste a job description — get an instant match score and personalised recommendation</div>
                    </div>
                </div>
                {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </button>

            {/* Expanded panel */}
            {open && (
                <div className="glass-card" style={{ padding: 28, marginTop: 8, borderColor: 'var(--accent-border)' }}>
                    {!result ? (
                        <>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
                                Paste the job description below (requirements, responsibilities, etc.)
                            </div>
                            <textarea
                                value={jdText}
                                onChange={e => setJdText(e.target.value)}
                                placeholder="Senior Software Engineer at XYZ Corp...&#10;&#10;Requirements: 5+ years Python, AWS experience, distributed systems..."
                                style={{ minHeight: 200, fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}
                            />
                            {error && (
                                <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: 13, marginBottom: 14 }}>
                                    {error}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {jdText.trim().split(/\s+/).filter(Boolean).length} words
                                </span>
                                <button
                                    className="btn-primary"
                                    onClick={analyze}
                                    disabled={loading || jdText.trim().split(/\s+/).length < 20}
                                    style={{ minWidth: 160, justifyContent: 'center' }}
                                >
                                    {loading
                                        ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
                                        : <><Target size={13} /> Analyze Fit</>}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ animation: 'fade-in 0.35s ease' }}>
                            {/* Personalised verdict banner */}
                            <div style={{
                                padding: '20px 24px', borderRadius: 'var(--radius-lg)',
                                background: vc.bg, border: `1px solid ${vc.border}`,
                                marginBottom: 24
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    {/* Score circle */}
                                    <div style={{
                                        width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                                        background: `${vc.color}15`, border: `2px solid ${vc.color}40`,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <span style={{ fontSize: 22, fontWeight: 900, color: vc.color, lineHeight: 1 }}>{result.fit_score}</span>
                                        <span style={{ fontSize: 9, color: vc.color, fontWeight: 600, opacity: 0.7 }}>/ 100</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: vc.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                                            {vc.icon} {result.verdict}
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, lineHeight: 1.4 }}>
                                            {result.personalized_message || vc.cta}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            {result.summary}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dimension bars */}
                            {result.dimension_scores && (
                                <div style={{ marginBottom: 24 }}>
                                    <div className="section-title" style={{ marginBottom: 12 }}>DIMENSION BREAKDOWN</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {Object.entries(result.dimension_scores).map(([key, score]) => {
                                            const c = score >= 80 ? '#22c55e' : score >= 60 ? '#4f6ef7' : score >= 40 ? '#f59e0b' : '#ef4444'
                                            return (
                                                <div key={key}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: c }}>{score}%</span>
                                                    </div>
                                                    <div style={{ height: 5, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${score}%`, background: c, borderRadius: 99, transition: 'width 0.8s ease' }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Skills grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                                {result.matched_skills?.length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            <CheckCircle size={12} color="#22c55e" />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', letterSpacing: '0.08em' }}>MATCHED ({result.matched_skills.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {result.matched_skills.map(s => <span key={s} className="tag tag-green">{s}</span>)}
                                        </div>
                                    </div>
                                )}
                                {result.partial_skills?.length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            <Minus size={12} color="#f59e0b" />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.08em' }}>PARTIAL ({result.partial_skills.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {result.partial_skills.map(s => <span key={s} className="tag tag-amber">{s}</span>)}
                                        </div>
                                    </div>
                                )}
                                {result.missing_skills?.length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            <AlertTriangle size={12} color="#ef4444" />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: '0.08em' }}>MISSING ({result.missing_skills.length})</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {result.missing_skills.map(s => <span key={s} className="tag tag-red">{s}</span>)}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Recruiter recommendation */}
                            {result.recommendation && (
                                <div style={{ padding: '14px 18px', background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)' }}>
                                    <div className="section-title" style={{ marginBottom: 8 }}>RECRUITER VIEW</div>
                                    <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--text-secondary)' }}>{result.recommendation}</p>
                                </div>
                            )}

                            {/* Re-analyze */}
                            <button className="btn-ghost" style={{ marginTop: 16, fontSize: 12 }} onClick={() => setResult(null)}>
                                ← Try a different job description
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ============================
// SCORE RING COMPONENT
// ============================
function ScoreRing({ score, size = 120, strokeWidth = 10, color = '#3b82f6', label }) {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (score / 100) * circumference

    const getColor = (s) => {
        if (s >= 85) return '#10b981'
        if (s >= 70) return '#3b82f6'
        if (s >= 55) return '#f59e0b'
        return '#ef4444'
    }

    const ringColor = getColor(score)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', width: size, height: size }}>
                <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                    {/* Track */}
                    <circle cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
                    {/* Progress */}
                    <circle cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke={ringColor} strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{
                            filter: `drop-shadow(0 0 8px ${ringColor}80)`,
                            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)'
                        }}
                    />
                </svg>
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <span style={{ fontSize: size >= 120 ? 28 : 18, fontWeight: 900, color: ringColor }}>{score}</span>
                    {size >= 120 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>}
                </div>
            </div>
            {label && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', maxWidth: 80 }}>{label}</div>}
        </div>
    )
}

// ============================
// SKILL CHIP
// ============================
function SkillChip({ name, category }) {
    const colors = {
        programming: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa' },
        frameworks: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)', text: '#a78bfa' },
        cloud: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', text: '#22d3ee' },
        databases: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#34d399' },
        ml: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
        tools: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
    }
    const c = colors[category] || colors.programming
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: c.bg, border: `1px solid ${c.border}`, color: c.text,
            whiteSpace: 'nowrap'
        }}>
            {name}
        </span>
    )
}

// ============================
// TIMELINE ITEM
// ============================
function TimelineItem({ job, index }) {
    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981']
    const color = colors[index % colors.length]

    return (
        <div style={{ display: 'flex', gap: 20, position: 'relative' }}>
            {/* Timeline line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: `${color}20`, border: `2px solid ${color}60`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1
                }}>
                    <Briefcase size={16} color={color} />
                </div>
                <div style={{ width: 2, flexGrow: 1, background: `${color}20`, marginTop: 4 }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 32 }}>
                <div className="glass-card" style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                        <div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{job.role}</div>
                            <div style={{ fontSize: 14, color, fontWeight: 600 }}>{job.company}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                                <Clock size={12} /> {job.duration}
                            </div>
                            {job.location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                                    <MapPin size={12} /> {job.location}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Years bar */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                            <span>Duration</span>
                            <span>{job.years} years</span>
                        </div>
                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{
                                height: '100%', borderRadius: 2,
                                background: `linear-gradient(90deg, ${color}, ${color}80)`,
                                width: `${Math.min(job.years / 5 * 100, 100)}%`,
                                transition: 'width 1s ease'
                            }} />
                        </div>
                    </div>

                    {/* Highlights */}
                    {job.highlights && (
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {job.highlights.map((h, i) => (
                                <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                                    <span style={{ color, fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>▸</span>
                                    {h}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================
// MAIN ANALYSIS PAGE
// ============================
export default function AnalysisPage() {
    const { resumeData } = useResume()
    const navigate = useNavigate()

    if (!resumeData) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: '100px 24px' }}>
                <div style={{ fontSize: 64 }}>📄</div>
                <h2 style={{ fontSize: 28, fontWeight: 700 }}>No Resume Analyzed Yet</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Upload a resume to see the analysis dashboard</p>
                <button className="btn-primary" onClick={() => navigate('/upload')}>
                    Upload Resume <ArrowRight size={16} />
                </button>
            </div>
        )
    }

    const { parsed, scores, strengths, improvements, keyword_analysis, career_level, recommended_roles } = resumeData
    const personal = parsed.personal_info
    const skills = parsed.skills

    // ==========================
    // CHART CONFIGS
    // ==========================
    const radarData = {
        labels: ['ATS', 'Experience', 'Skills Match', 'Education', 'Presentation', 'Impact', 'Keywords', 'Readability'],
        datasets: [{
            label: 'Score',
            data: [
                scores.ats_compatibility, scores.experience_relevance, scores.skills_match,
                scores.education, scores.presentation, scores.impact_metrics,
                scores.keywords, scores.readability
            ],
            backgroundColor: 'rgba(59,130,246,0.15)',
            borderColor: '#3b82f6',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#3b82f6',
            pointRadius: 5
        }]
    }

    const radarOptions = {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,22,40,0.95)', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 } },
        scales: {
            r: {
                beginAtZero: true, max: 100, min: 0,
                grid: { color: 'rgba(255,255,255,0.06)' },
                angleLines: { color: 'rgba(255,255,255,0.06)' },
                pointLabels: { color: 'rgba(240,246,255,0.65)', font: { size: 11, weight: '600' } },
                ticks: { backdropColor: 'transparent', color: 'rgba(240,246,255,0.3)', font: { size: 9 }, stepSize: 20 }
            }
        }
    }

    const scoreNames = {
        overall: 'Overall', ats_compatibility: 'ATS', experience_relevance: 'Experience',
        skills_match: 'Skills', education: 'Education', presentation: 'Presentation',
        impact_metrics: 'Impact', keywords: 'Keywords', readability: 'Readability', completeness: 'Completeness'
    }

    const barData = {
        labels: Object.keys(scores).filter(k => k !== 'overall').map(k => scoreNames[k] || k),
        datasets: [{
            label: 'Score',
            data: Object.keys(scores).filter(k => k !== 'overall').map(k => scores[k]),
            backgroundColor: Object.keys(scores).filter(k => k !== 'overall').map(k => {
                const v = scores[k]
                if (v >= 85) return 'rgba(16,185,129,0.7)'
                if (v >= 70) return 'rgba(59,130,246,0.7)'
                if (v >= 55) return 'rgba(245,158,11,0.7)'
                return 'rgba(239,68,68,0.7)'
            }),
            borderRadius: 8,
            borderSkipped: false
        }]
    }

    const barOptions = {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(10,22,40,0.95)', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 } },
        scales: {
            x: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(240,246,255,0.4)' }, border: { display: false } },
            y: { grid: { display: false }, ticks: { color: 'rgba(240,246,255,0.65)', font: { weight: '600' } }, border: { display: false } }
        }
    }

    // Skill distribution doughnut
    const skillCounts = {
        Programming: (skills.programming || []).length,
        Frameworks: (skills.frameworks || []).length,
        Cloud: (skills.cloud || []).length,
        Databases: (skills.databases || []).length,
        ML: (skills.ml || []).length,
        Tools: (skills.tools || []).length
    }
    const doughnutData = {
        labels: Object.keys(skillCounts),
        datasets: [{
            data: Object.values(skillCounts),
            backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(139,92,246,0.8)', 'rgba(6,182,212,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'],
            borderColor: 'rgba(5,10,20,0.8)',
            borderWidth: 3,
            hoverOffset: 6
        }]
    }
    const doughnutOptions = {
        responsive: true, cutout: '68%',
        plugins: {
            legend: { position: 'right', labels: { color: 'rgba(240,246,255,0.65)', padding: 12, font: { size: 12 }, boxWidth: 12, borderRadius: 4 } },
            tooltip: { backgroundColor: 'rgba(10,22,40,0.95)', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 }
        }
    }

    // Experience timeline chart (horizontal bar by years)
    const expBarData = {
        labels: parsed.experience.map(e => e.company),
        datasets: [{
            label: 'Years',
            data: parsed.experience.map(e => e.years),
            backgroundColor: ['rgba(59,130,246,0.7)', 'rgba(139,92,246,0.7)', 'rgba(6,182,212,0.7)', 'rgba(16,185,129,0.7)'],
            borderRadius: 8,
            borderSkipped: false
        }]
    }

    const totalSkills = Object.values(skillCounts).reduce((a, b) => a + b, 0)

    return (
        <div style={{ minHeight: '100vh', padding: '90px 24px 60px', maxWidth: 1200, margin: '0 auto' }}>

            {/* ========================
           HEADER  
          ======================== */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
                <div>
                    <div className="section-title">RESUME ANALYSIS</div>
                    <h1 style={{ fontSize: 40, fontWeight: 900 }}>
                        {personal.name || 'Candidate'} <span className="gradient-text">Report</span>
                    </h1>

                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" onClick={() => navigate('/chat')}>
                        <MessageSquare size={16} /> Chat with Resume
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/upload')}>
                        <ArrowRight size={16} /> New Resume
                    </button>
                </div>
            </div>

            {/* ========================
           HERO SCORE SECTION  
          ======================== */}
            <div className="glass-card" style={{
                padding: '40px 48px', marginBottom: 32,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.06) 100%)',
                borderColor: 'rgba(59,130,246,0.2)'
            }}>
                <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* Main score */}
                    <div style={{ textAlign: 'center' }}>
                        <ScoreRing score={scores.overall} size={160} strokeWidth={14} />
                        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>OVERALL SCORE</div>
                    </div>

                    {/* Vertical divider */}
                    <div style={{ width: 1, height: 120, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} className="hide-mobile" />

                    {/* Personal info */}
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>{personal.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', marginBottom: 16, fontWeight: 600, fontSize: 14 }}>
                            <Target size={14} /> {career_level}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {personal.email && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}><Mail size={13} />{personal.email}</div>}
                            {personal.phone && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}><Phone size={13} />{personal.phone}</div>}
                            {personal.location && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-secondary)', fontSize: 13 }}><MapPin size={13} />{personal.location}</div>}
                            {personal.linkedin && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#60a5fa', fontSize: 13 }}><Linkedin size={13} />{personal.linkedin}</div>}
                            {personal.github && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#a78bfa', fontSize: 13 }}><Github size={13} />{personal.github}</div>}
                        </div>
                    </div>

                    {/* Sub-scores mini rings */}
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[
                            { key: 'ats_compatibility', label: 'ATS' },
                            { key: 'experience_relevance', label: 'Experience' },
                            { key: 'skills_match', label: 'Skills' },
                            { key: 'impact_metrics', label: 'Impact' },
                        ].map(({ key, label }) => (
                            <ScoreRing key={key} score={scores[key]} size={90} strokeWidth={8} label={label} />
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================
           CHARTS ROW 1: RADAR + BAR  
          ======================== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24, marginBottom: 24 }}>
                {/* Radar Chart */}
                <div className="glass-card" style={{ padding: 28 }}>
                    <div className="section-title" style={{ marginBottom: 16 }}>SKILL RADAR</div>
                    <Radar data={radarData} options={radarOptions} />
                </div>

                {/* Bar Chart — all dimensions */}
                <div className="glass-card" style={{ padding: 28 }}>
                    <div className="section-title" style={{ marginBottom: 16 }}>SCORE BREAKDOWN</div>
                    <Bar data={barData} options={barOptions} />
                </div>
            </div>

            {/* ========================
           CHARTS ROW 2: DOUGHNUT + EXP BAR  
          ======================== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                {/* Skill Distribution */}
                <div className="glass-card" style={{ padding: 28 }}>
                    <div className="section-title" style={{ marginBottom: 4 }}>SKILL DISTRIBUTION</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>{totalSkills} skills across {Object.keys(skillCounts).length} categories</div>
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                </div>

                {/* Experience Years Bar */}
                <div className="glass-card" style={{ padding: 28 }}>
                    <div className="section-title" style={{ marginBottom: 4 }}>EXPERIENCE BY COMPANY</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 20 }}>
                        Years of experience per role
                    </div>
                    <Bar data={expBarData} options={{
                        ...barOptions,
                        indexAxis: 'y',
                        plugins: { ...barOptions.plugins, tooltip: barOptions.plugins.tooltip },
                        scales: {
                            x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: 'rgba(240,246,255,0.4)' }, border: { display: false } },
                            y: { grid: { display: false }, ticks: { color: 'rgba(240,246,255,0.65)', font: { weight: '600' } }, border: { display: false } }
                        }
                    }} />
                </div>
            </div>

            {/* ========================
           ALL MINI SCORE RINGS  
          ======================== */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <div className="section-title" style={{ marginBottom: 24 }}>DIMENSION SCORES</div>
                <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {Object.entries(scores).map(([key, val]) => (
                        <ScoreRing key={key} score={val} size={100} strokeWidth={9} label={scoreNames[key] || key} />
                    ))}
                </div>
            </div>

            {/* ========================
           SKILLS SECTION  
          ======================== */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <Code size={20} color="#3b82f6" />
                    <div className="section-title" style={{ margin: 0 }}>SKILLS & TECHNOLOGIES</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {Object.entries(skills).map(([category, skillList]) => (
                        skillList && skillList.length > 0 && (
                            <div key={category}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
                                    {category.charAt(0).toUpperCase() + category.slice(1)}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {skillList.map(skill => (
                                        <SkillChip key={skill} name={skill} category={category} />
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>

            {/* ========================
           EXPERIENCE TIMELINE  
          ======================== */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
                    <Briefcase size={20} color="#8b5cf6" />
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Work Experience</h2>
                </div>
                {parsed.experience.map((job, i) => (
                    <TimelineItem key={i} job={job} index={i} />
                ))}
            </div>

            {/* ========================
           EDUCATION  
          ======================== */}
            <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <GraduationCap size={20} color="#06b6d4" />
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Education</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {parsed.education.map((edu, i) => {
                        const colors = ['#3b82f6', '#8b5cf6', '#06b6d4']
                        const c = colors[i % colors.length]
                        return (
                            <div key={i} style={{
                                padding: '20px 24px', borderRadius: 14,
                                background: `${c}08`, border: `1px solid ${c}20`
                            }}>
                                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{edu.institution}</div>
                                <div style={{ fontSize: 14, color: c, fontWeight: 600, marginBottom: 8 }}>{edu.degree}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {edu.graduation && <span className="tag tag-blue">Class of {edu.graduation}</span>}
                                    {edu.gpa && <span className="tag tag-green">GPA: {edu.gpa}</span>}
                                    {edu.honors && <span className="tag tag-amber">{edu.honors}</span>}
                                </div>
                                {edu.specialization && (
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
                                        Specialization: {edu.specialization}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ========================
           KEYWORDS  
          ======================== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <CheckCircle size={16} color="#10b981" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>KEYWORDS FOUND ({keyword_analysis.found.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {keyword_analysis.found.map(kw => (
                            <span key={kw} className="tag tag-green">{kw}</span>
                        ))}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <AlertTriangle size={16} color="#f59e0b" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>MISSING KEYWORDS ({keyword_analysis.missing.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {keyword_analysis.missing.map(kw => (
                            <span key={kw} className="tag tag-amber">{kw}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================
           STRENGTHS & IMPROVEMENTS  
          ======================== */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
                <div className="glass-card" style={{ padding: 28, borderColor: 'rgba(16,185,129,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Star size={18} color="#10b981" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>Strengths</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {strengths.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12 }}>
                                <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                                <span style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glass-card" style={{ padding: 28, borderColor: 'rgba(245,158,11,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <TrendingUp size={18} color="#f59e0b" />
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24' }}>Areas to Improve</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {improvements.map((s, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12 }}>
                                <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                                <span style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{s}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ========================
           CERTIFICATIONS & PROJECTS  
          ======================== */}
            {parsed.certifications && parsed.certifications.length > 0 && (
                <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Award size={20} color="#f59e0b" />
                        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Certifications</h2>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {parsed.certifications.map((cert, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 18px', borderRadius: 12,
                                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)'
                            }}>
                                <Award size={16} color="#fbbf24" />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{cert.name}</div>
                                    {cert.year && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cert.year}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {parsed.projects && parsed.projects.length > 0 && (
                <div className="glass-card" style={{ padding: 32, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Code size={20} color="#8b5cf6" />
                        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Projects</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                        {parsed.projects.map((proj, i) => (
                            <div key={i} className="glass-card" style={{ padding: '20px 22px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                                    <div style={{ fontSize: 15, fontWeight: 700 }}>{proj.name}</div>
                                    {proj.link && <ExternalLink size={14} color="#60a5fa" style={{ flexShrink: 0, cursor: 'pointer' }} />}
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{proj.description}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {(proj.tech || []).map(t => <span key={t} className="tag tag-violet">{t}</span>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ========================
           RECOMMENDED ROLES  
          ======================== */}
            {recommended_roles && recommended_roles.length > 0 && (
                <div className="glass-card" style={{ padding: 32, marginBottom: 24, background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Target size={20} color="#3b82f6" />
                        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recommended Roles</h2>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {recommended_roles.map((role, i) => (
                            <div key={i} style={{
                                padding: '10px 20px', borderRadius: 10,
                                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
                                fontSize: 14, fontWeight: 600, color: '#60a5fa',
                                cursor: 'pointer', transition: 'all 0.2s ease'
                            }}
                                onMouseEnter={e => { e.target.style.background = 'rgba(59,130,246,0.2)'; e.target.style.transform = 'translateY(-2px)' }}
                                onMouseLeave={e => { e.target.style.background = 'rgba(59,130,246,0.1)'; e.target.style.transform = 'none' }}
                            >
                                {role}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* JD Fit — inline panel */}
            <JDFitPanel resumeId={resumeData.resume_id} />

            {/* Chat CTA */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 20,
                padding: '28px 32px', borderRadius: 16,
                background: 'var(--surface-1)', border: '1px solid var(--border-1)'
            }}>
                <MessageSquare size={24} color="var(--accent)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 3 }}>Want to go deeper?</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Chat with the resume — ask anything, get sourced answers</div>
                </div>
                <button className="btn-primary" onClick={() => navigate('/chat')} style={{ flexShrink: 0 }}>
                    Open Chat <ArrowRight size={14} />
                </button>
            </div>
        </div>
    )
}
