import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Brain, Upload, BarChart3, MessageSquare, ArrowRight,
    Cpu, Shield, Target, Zap, ChevronRight, Sparkles,
    TrendingUp, Database, Lock, Activity, Star
} from 'lucide-react'

/* ── Feature data ── */
const FEATURES = [
    {
        icon: Upload, title: 'Smart Upload', tag: 'S3 Presigned',
        desc: 'Browser uploads directly to S3 via presigned URL — zero bytes traverse the API server.',
        color: '#5b72f9', color2: '#7c4dff',
    },
    {
        icon: MessageSquare, title: 'Chat with Resume', tag: 'RAG · Vector',
        desc: 'Ask anything. OpenSearch k-NN retrieval + Bedrock Claude 3 Sonnet delivers instant answers.',
        color: '#00d4b4', color2: '#22d3ee',
    },
    {
        icon: BarChart3, title: 'Visual Analytics', tag: '10 Dimensions',
        desc: '10-axis scoring visualized as radar charts, score rings, and a dynamic experience timeline.',
        color: '#9f7aea', color2: '#c084fc',
    },
    {
        icon: Target, title: 'JD Fit Analysis', tag: 'New',
        desc: 'Paste any job description — get a fit score, matched/missing skills, and recruiter recommendation.',
        color: '#10d98e', color2: '#34d399',
    },
    {
        icon: Cpu, title: 'AWS Bedrock AI', tag: 'IAM Auth',
        desc: 'Claude 3 Sonnet parses. Titan Embeddings v2 generates 1024-dim vectors. No OpenAI keys.',
        color: '#f5a623', color2: '#fb923c',
    },
    {
        icon: Shield, title: 'Enterprise Security', tag: 'Zero Trust',
        desc: 'IAM task roles, no static keys. SQS+DLQ for resilience. AES-256 S3 encryption at rest.',
        color: '#ff4d6d', color2: '#fb7185',
    },
]

/* ── Architecture steps ── */
const ARCH = [
    { label: 'Browser', sub: 'React + Vite', color: '#5b72f9', icon: Activity },
    { label: 'S3', sub: 'Presigned PUT', color: '#f5a623', icon: Database },
    { label: 'SQS', sub: 'Async queue', color: '#00d4b4', icon: Zap },
    { label: 'ECS', sub: 'Bedrock · OS', color: '#9f7aea', icon: Cpu },
    { label: 'DynamoDB', sub: 'State · meta', color: '#10d98e', icon: Lock },
]

/* ── Stats ── */
const STATS = [
    { val: '10', label: 'Score Axes', icon: TrendingUp },
    { val: '1024', label: 'Vector Dims', icon: Activity },
    { val: '< 2s', label: 'Presign Latency', icon: Zap },
    { val: '99.9%', label: 'AWS SLA', icon: Star },
]

/* ── Animated number counter ── */
function CountUp({ target, suffix = '' }) {
    const [val, setVal] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        const num = parseFloat(target.replace(/[^0-9.]/g, ''))
        if (isNaN(num)) { setVal(target); return }
        let start = null
        const duration = 1200
        const step = (ts) => {
            if (!start) start = ts
            const progress = Math.min((ts - start) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setVal(Math.floor(eased * num))
            if (progress < 1) ref.current = requestAnimationFrame(step)
            else setVal(target)
        }
        ref.current = requestAnimationFrame(step)
        return () => cancelAnimationFrame(ref.current)
    }, [target])

    return <>{val}{suffix}</>
}

/* ── 3D tilt card ── */
function TiltCard({ children, style, className = '' }) {
    const cardRef = useRef(null)

    const handleMouseMove = (e) => {
        const card = cardRef.current
        if (!card) return
        const rect = card.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const cx = rect.width / 2
        const cy = rect.height / 2
        const rotY = ((x - cx) / cx) * 6
        const rotX = -((y - cy) / cy) * 6
        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(8px)`
    }

    const handleMouseLeave = () => {
        const card = cardRef.current
        if (card) card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateZ(0)'
    }

    return (
        <div
            ref={cardRef}
            className={`glass-card card-glow ${className}`}
            style={{
                transition: 'transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease',
                cursor: 'default',
                ...style,
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}
        </div>
    )
}

export default function LandingPage() {
    const navigate = useNavigate()
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 80)
        return () => clearTimeout(t)
    }, [])

    /* Intersection observer for feature cards */
    const featureRef = useRef(null)
    const [featuresVisible, setFeaturesVisible] = useState(false)
    useEffect(() => {
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) setFeaturesVisible(true) },
            { threshold: 0.1 }
        )
        if (featureRef.current) obs.observe(featureRef.current)
        return () => obs.disconnect()
    }, [])

    return (
        <div style={{ minHeight: '100vh', overflowX: 'hidden' }}>

            {/* ══════════════════ HERO ══════════════════ */}
            <section style={{
                minHeight: '100vh',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '90px 24px 60px',
                position: 'relative',
            }}>
                {/* Glow rings */}
                <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                }}>
                    {[600, 900, 1200].map((size, i) => (
                        <div key={size} style={{
                            position: 'absolute',
                            width: size, height: size,
                            borderRadius: '50%',
                            border: '1px solid var(--accent-border)',
                            opacity: 0.3 - i * 0.08,
                            animation: `pulse-glow ${4 + i * 1.5}s ease-in-out ${i * 0.8}s infinite`,
                        }} />
                    ))}
                </div>

                {/* Floating decoration orbs */}
                <div style={{
                    position: 'absolute', top: '15%', right: '8%',
                    width: 200, height: 200, borderRadius: '50%',
                    background: 'radial-gradient(circle, var(--orb-1) 0%, transparent 70%)',
                    animation: 'float 7s ease-in-out infinite',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: '20%', left: '5%',
                    width: 160, height: 160, borderRadius: '50%',
                    background: 'radial-gradient(circle, var(--orb-2) 0%, transparent 70%)',
                    animation: 'float-reverse 9s ease-in-out infinite',
                    pointerEvents: 'none',
                }} />

                {/* Hero content */}
                <div style={{
                    textAlign: 'center', maxWidth: 760, width: '100%',
                    position: 'relative', zIndex: 1,
                    opacity: visible ? 1 : 0,
                    transition: 'opacity 0.6s ease',
                }}>
                    {/* Eyebrow badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--accent-border)',
                        borderRadius: 99, padding: '6px 16px 6px 10px',
                        fontSize: 12, color: 'var(--accent)', fontWeight: 600,
                        letterSpacing: '0.03em',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 0 20px var(--accent-glow)',
                        marginBottom: 36,
                        animation: 'pulse-glow 4s ease-in-out infinite',
                    }}>
                        <Sparkles size={12} />
                        Bedrock · OpenSearch · SQS · ECS Fargate
                    </div>

                    {/* Main heading */}
                    <h1 style={{
                        fontSize: 'clamp(48px, 7.5vw, 88px)',
                        fontWeight: 800,
                        lineHeight: 1.02,
                        letterSpacing: '-0.035em',
                        marginBottom: 28,
                        fontFamily: 'var(--font-display)',
                        animation: 'slide-up 0.7s var(--ease-out) 0.1s both',
                    }}>
                        Resume Intelligence,{' '}<br />
                        <span className="gradient-text">AWS&#8209;Native</span>
                    </h1>

                    <p style={{
                        fontSize: 'clamp(15px, 1.8vw, 18px)',
                        color: 'var(--text-2)',
                        lineHeight: 1.8,
                        maxWidth: 580,
                        margin: '0 auto 48px',
                        animation: 'slide-up 0.7s var(--ease-out) 0.2s both',
                    }}>
                        Upload, parse, score, and chat with any resume — backed by a
                        production-grade AWS architecture with Bedrock AI, vector search,
                        and asynchronous job processing.
                    </p>

                    {/* CTAs */}
                    <div style={{
                        display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
                        animation: 'slide-up 0.7s var(--ease-out) 0.3s both',
                    }}>
                        <button
                            id="hero-analyze-btn"
                            className="btn-primary"
                            onClick={() => navigate('/upload')}
                            style={{ padding: '12px 30px', fontSize: 14, position: 'relative', overflow: 'hidden' }}
                        >
                            <span className="btn-beam" />
                            <Upload size={15} />
                            Analyze Resume
                            <ArrowRight size={15} />
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={() => navigate('/analysis')}
                            style={{ padding: '12px 24px', fontSize: 14 }}
                        >
                            <BarChart3 size={14} />
                            View Analysis
                        </button>
                        <button
                            className="btn-ghost"
                            onClick={() => navigate('/chat')}
                            style={{ padding: '12px 24px', fontSize: 14 }}
                        >
                            <MessageSquare size={14} />
                            Chat with Resume
                        </button>
                    </div>

                    {/* Stats row */}
                    <div style={{
                        display: 'flex', gap: 0, justifyContent: 'center',
                        marginTop: 72, flexWrap: 'wrap',
                        animation: 'slide-up 0.7s var(--ease-out) 0.45s both',
                    }}>
                        {STATS.map(({ val, label, icon: Icon }, i) => (
                            <div key={label} style={{
                                textAlign: 'center', padding: '0 32px',
                                borderRight: i < STATS.length - 1 ? '1px solid var(--glass-border)' : 'none',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                                    <Icon size={14} color="var(--accent)" style={{ opacity: 0.7 }} />
                                </div>
                                <div className="gradient-text" style={{
                                    fontSize: 32, fontWeight: 800,
                                    letterSpacing: '-0.04em',
                                    fontFamily: 'var(--font-display)',
                                }}>
                                    {val}
                                </div>
                                <div style={{
                                    fontSize: 10, color: 'var(--text-3)', marginTop: 4,
                                    fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                                }}>
                                    {label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══════════════════ FEATURES ══════════════════ */}
            <section
                ref={featureRef}
                style={{ padding: '20px 24px 100px', maxWidth: 1200, margin: '0 auto' }}
            >
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <div className="section-label">CAPABILITIES</div>
                    <h2 style={{
                        fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800,
                        fontFamily: 'var(--font-display)',
                    }}>
                        Built for <span className="gradient-text">production</span>
                    </h2>
                    <p style={{ marginTop: 12, fontSize: 15, maxWidth: 420, margin: '12px auto 0', color: 'var(--text-2)' }}>
                        Every feature is backed by enterprise-grade AWS infrastructure.
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                    gap: 16,
                }}>
                    {FEATURES.map(({ icon: Icon, title, desc, color, color2, tag }, idx) => (
                        <TiltCard
                            key={title}
                            style={{
                                padding: '28px 28px 26px',
                                opacity: featuresVisible ? 1 : 0,
                                transform: featuresVisible ? 'none' : 'translateY(24px)',
                                transition: `opacity 0.5s ease ${idx * 0.07}s, transform 0.5s var(--ease-out) ${idx * 0.07}s, border-color 0.25s ease, box-shadow 0.25s ease`,
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 14,
                                    background: `linear-gradient(135deg, ${color}22, ${color2}14)`,
                                    border: `1px solid ${color}30`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: `0 0 20px ${color}18`,
                                    position: 'relative', overflow: 'hidden',
                                }}>
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)',
                                    }} />
                                    <Icon size={20} color={color} />
                                </div>
                                <span style={{
                                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em',
                                    color, background: `${color}14`,
                                    border: `1px solid ${color}28`,
                                    padding: '3px 9px', borderRadius: 99,
                                    textTransform: 'uppercase',
                                    backdropFilter: 'blur(8px)',
                                }}>
                                    {tag}
                                </span>
                            </div>
                            <h3 style={{
                                fontSize: 15.5, fontWeight: 700, marginBottom: 10,
                                fontFamily: 'var(--font-display)',
                                color: 'var(--text-1)',
                            }}>
                                {title}
                            </h3>
                            <p style={{ color: 'var(--text-2)', lineHeight: 1.75, fontSize: 13 }}>
                                {desc}
                            </p>

                            {/* Bottom accent line */}
                            <div style={{
                                height: 2, marginTop: 20,
                                background: `linear-gradient(90deg, ${color}40, ${color2}20, transparent)`,
                                borderRadius: 99,
                            }} />
                        </TiltCard>
                    ))}
                </div>
            </section>

            {/* ══════════════════ ARCHITECTURE FLOW ══════════════════ */}
            <section style={{ padding: '0 24px 100px' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
                    <div className="section-label">AWS DATA FLOW</div>
                    <h2 style={{
                        fontSize: 'clamp(26px, 3.5vw, 40px)', fontWeight: 800,
                        fontFamily: 'var(--font-display)', marginBottom: 52,
                    }}>
                        How a resume travels{' '}
                        <span className="gradient-text">through the stack</span>
                    </h2>

                    {/* Flow nodes */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexWrap: 'wrap', gap: 0,
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 24, padding: '28px 24px',
                        backdropFilter: 'blur(20px)',
                        boxShadow: 'var(--shadow-md)',
                    }}>
                        {ARCH.map(({ label, sub, color, icon: ArchIcon }, i) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                                <div
                                    className="arch-node"
                                    style={{ borderColor: `${color}28` }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = `${color}60`
                                        e.currentTarget.style.boxShadow = `0 0 24px ${color}20`
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = `${color}28`
                                        e.currentTarget.style.boxShadow = ''
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: `${color}16`,
                                        border: `1px solid ${color}28`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 10px',
                                    }}>
                                        <ArchIcon size={16} color={color} />
                                    </div>
                                    <div style={{
                                        fontSize: 13.5, fontWeight: 700, color,
                                        fontFamily: 'var(--font-display)',
                                    }}>
                                        {label}
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3 }}>
                                        {sub}
                                    </div>
                                </div>
                                {i < ARCH.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px' }}>
                                        <div style={{
                                            width: 24, height: 2,
                                            background: 'linear-gradient(90deg, var(--accent), var(--teal))',
                                            borderRadius: 99, opacity: 0.4,
                                        }} />
                                        <ChevronRight size={12} color="var(--text-3)" style={{ marginLeft: 2 }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <p style={{
                        marginTop: 24, fontSize: 13, color: 'var(--text-3)',
                        maxWidth: 580, margin: '24px auto 0', lineHeight: 1.7,
                    }}>
                        Frontend uploads directly to S3 via presigned URL. API publishes a job to SQS.
                        ECS Worker consumes it, runs Bedrock, indexes to OpenSearch, writes to DynamoDB.
                        No file bytes flow through the API server.
                    </p>
                </div>
            </section>

            {/* ══════════════════ CTA ══════════════════ */}
            <section style={{ padding: '0 24px 120px' }}>
                <div style={{ maxWidth: 700, margin: '0 auto' }}>
                    <div className="cta-card" style={{
                        padding: '60px 48px',
                        textAlign: 'center',
                    }}>
                        <div className="cta-card-inner">
                            {/* Brain icon with glow ring */}
                            <div style={{
                                position: 'relative', display: 'inline-flex',
                                marginBottom: 24,
                            }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: 20,
                                    background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 0 40px var(--accent-glow)',
                                    animation: 'pulse-glow 3s ease-in-out infinite',
                                }}>
                                    <Brain size={30} color="#fff" />
                                </div>
                            </div>

                            <h2 style={{
                                fontSize: 'clamp(26px, 3vw, 36px)',
                                fontWeight: 800, marginBottom: 12,
                                letterSpacing: '-0.025em',
                                fontFamily: 'var(--font-display)',
                            }}>
                                Ready to see the magic?
                            </h2>
                            <p style={{
                                color: 'var(--text-2)', marginBottom: 36, fontSize: 15,
                                lineHeight: 1.7, maxWidth: 420, margin: '0 auto 36px',
                            }}>
                                Upload a PDF or DOCX resume and the full AWS pipeline kicks in —
                                Bedrock parses, Titan embeds, OpenSearch indexes, DynamoDB stores.
                            </p>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button
                                    id="cta-start-btn"
                                    className="btn-primary"
                                    onClick={() => navigate('/upload')}
                                    style={{ padding: '12px 28px', fontSize: 14, position: 'relative', overflow: 'hidden' }}
                                >
                                    <span className="btn-beam" />
                                    <Upload size={15} />
                                    Upload & Analyze
                                    <ArrowRight size={15} />
                                </button>
                                <button
                                    className="btn-ghost"
                                    onClick={() => navigate('/chat')}
                                    style={{ padding: '12px 22px', fontSize: 14 }}
                                >
                                    <MessageSquare size={14} />
                                    Chat with Resume
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
