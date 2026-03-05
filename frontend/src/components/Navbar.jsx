import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Brain, Upload, BarChart2, MessageSquare, Clock, Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

const NAV = [
    { to: '/upload', label: 'Upload', icon: Upload },
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/analysis', label: 'Analysis', icon: BarChart2 },
    { to: '/history', label: 'History', icon: Clock },
]

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false)
    const location = useLocation()
    const { theme, toggle } = useTheme()

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 16)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    return (
        <nav
            className={`navbar-container${scrolled ? ' scrolled' : ''}`}
            style={{ transition: 'all 0.3s ease' }}
        >
            <div style={{
                maxWidth: 1200, margin: '0 auto', padding: '0 28px',
                height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16,
            }}>

                {/* ── Logo ── */}
                <NavLink to="/" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    textDecoration: 'none', flexShrink: 0,
                }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 16px var(--accent-glow)',
                        transition: 'box-shadow 0.3s ease',
                    }}>
                        <Brain size={17} color="#fff" />
                    </div>
                    <span style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 700, fontSize: 15,
                        letterSpacing: '-0.025em',
                        color: 'var(--text-1)',
                    }}>
                        RESU<span style={{ color: 'var(--accent)' }}>.</span>GENIE
                    </span>
                </NavLink>

                {/* ── Nav Links ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                }}>
                    {NAV.map(({ to, label, icon: Icon }) => {
                        const active = location.pathname === to
                        return (
                            <NavLink
                                key={to}
                                to={to}
                                id={`nav-${label.toLowerCase()}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '7px 13px', borderRadius: 10,
                                    fontSize: 13,
                                    fontWeight: active ? 600 : 500,
                                    color: active ? 'var(--text-1)' : 'var(--text-2)',
                                    background: active ? 'var(--glass-bg)' : 'transparent',
                                    border: `1px solid ${active ? 'var(--glass-border-h)' : 'transparent'}`,
                                    transition: 'all 0.2s ease',
                                    textDecoration: 'none',
                                    position: 'relative',
                                    backdropFilter: active ? 'blur(12px)' : 'none',
                                }}
                                onMouseEnter={e => {
                                    if (!active) {
                                        e.currentTarget.style.color = 'var(--text-1)'
                                        e.currentTarget.style.background = 'var(--glass-bg)'
                                        e.currentTarget.style.borderColor = 'var(--glass-border)'
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!active) {
                                        e.currentTarget.style.color = 'var(--text-2)'
                                        e.currentTarget.style.background = 'transparent'
                                        e.currentTarget.style.borderColor = 'transparent'
                                    }
                                }}
                            >
                                <Icon size={13} />
                                <span className="hide-mobile">{label}</span>
                                {active && (
                                    <span style={{
                                        position: 'absolute', bottom: -1, left: '20%', right: '20%',
                                        height: 2,
                                        background: 'linear-gradient(90deg, var(--accent), var(--teal))',
                                        borderRadius: 99,
                                        boxShadow: '0 0 8px var(--accent-glow)',
                                    }} />
                                )}
                            </NavLink>
                        )
                    })}
                </div>

                {/* ── Right Controls ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {/* Dark / Light toggle */}
                    <button
                        id="theme-toggle-btn"
                        className="theme-toggle"
                        onClick={toggle}
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                        style={{ cursor: 'pointer' }}
                    >
                        {theme === 'dark'
                            ? <Sun size={15} strokeWidth={2} />
                            : <Moon size={15} strokeWidth={2} />
                        }
                    </button>
                </div>
            </div>
        </nav>
    )
}
