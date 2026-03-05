import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResume } from '../context/ResumeContext'
import ReactMarkdown from 'react-markdown'
import {
    Send, Bot, User, Brain, Upload, ArrowRight,
    Lightbulb, BarChart3, Briefcase, GraduationCap, Code, MessageSquare
} from 'lucide-react'
import axios from 'axios'

const SUGGESTED_QUESTIONS = [
    { icon: Briefcase, text: 'What is the most impressive work experience?', color: '#3b82f6' },
    { icon: Code, text: 'List all technical skills and rate their depth', color: '#8b5cf6' },
    { icon: GraduationCap, text: 'Tell me about the educational background', color: '#06b6d4' },
    { icon: BarChart3, text: 'What roles would this candidate be best suited for?', color: '#10b981' },
    { icon: Lightbulb, text: "What are this candidate's biggest strengths?", color: '#f59e0b' },
    { icon: Brain, text: 'What salary range should this candidate target?', color: '#ef4444' },
]

function TypingIndicator() {
    return (
        <div style={{ display: 'flex', gap: 4, padding: '16px 20px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#60a5fa',
                    animation: `typing-dot 1.4s ease-in-out ${i * 0.2}s infinite`
                }} />
            ))}
        </div>
    )
}

function ChatMessage({ msg }) {
    const isAI = msg.role === 'assistant'
    return (
        <div style={{
            display: 'flex', gap: 14,
            justifyContent: isAI ? 'flex-start' : 'flex-end',
            marginBottom: 20,
            animation: 'slide-in 0.3s ease'
        }}>
            {isAI && (
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-dim)',
                    border: '1px solid var(--accent-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Brain size={16} color="var(--accent)" />
                </div>
            )}

            <div style={{
                maxWidth: '75%',
                background: isAI
                    ? 'rgba(59,130,246,0.08)'
                    : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.15))',
                border: `1px solid ${isAI ? 'rgba(59,130,246,0.2)' : 'rgba(139,92,246,0.25)'}`,
                borderRadius: isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '14px 18px'
            }}>
                {isAI ? (
                    <div className="ai-message-content" style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                ) : (
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>{msg.content}</div>
                )}

                {/* Source chips */}
                {msg.sources && msg.sources.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {msg.sources.map((s, i) => (
                            <span key={i} style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                                color: '#60a5fa'
                            }}>
                                {s.section} · {Math.round(s.relevance * 100)}%
                            </span>
                        ))}
                    </div>
                )}

                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: isAI ? 'left' : 'right' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>

            {!isAI && (
                <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <User size={18} color="rgba(240,246,255,0.7)" />
                </div>
            )}
        </div>
    )
}

export default function ChatPage() {
    const { resumeData } = useResume()
    const navigate = useNavigate()
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    // Welcome message
    useEffect(() => {
        if (resumeData) {
            setMessages([{
                role: 'assistant',
                content: `# Hello! I'm RESU-GENIE 🤖\n\nI've analyzed **${resumeData.parsed?.personal_info?.name || 'the candidate'}'s** resume and I'm ready to answer any questions about their:\n\n- 💼 Work experience & achievements\n- 🛠️ Technical skills & expertise\n- 🎓 Education & certifications\n- 🚀 Projects & contributions\n- 💡 Career recommendations\n\nWhat would you like to know?`,
                timestamp: new Date().toISOString(),
                sources: []
            }])
        }
    }, [resumeData])

    const sendMessage = async (text) => {
        const messageText = text || input.trim()
        if (!messageText || loading) return

        setInput('')

        const userMsg = { role: 'user', content: messageText, timestamp: new Date().toISOString() }
        setMessages(prev => [...prev, userMsg])
        setLoading(true)

        try {
            const response = await axios.post('/api/chat', {
                message: messageText,
                resume_id: resumeData?.resume_id || '',
                history: messages.map(m => ({ role: m.role, content: m.content }))
            })

            const assistantMsg = {
                role: 'assistant',
                content: response.data.response,
                sources: response.data.sources || [],
                timestamp: new Date().toISOString()
            }
            setMessages(prev => [...prev, assistantMsg])
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '⚠️ Sorry, I ran into an error. Please try again.',
                timestamp: new Date().toISOString(),
                sources: []
            }])
        } finally {
            setLoading(false)
            inputRef.current?.focus()
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    if (!resumeData) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, padding: '100px 24px' }}>
                <MessageSquare size={64} color="rgba(59,130,246,0.5)" />
                <h2 style={{ fontSize: 28, fontWeight: 700 }}>No Resume Loaded</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Upload and analyze a resume first to start chatting</p>
                <button className="btn-primary" onClick={() => navigate('/upload')}>
                    Upload Resume <ArrowRight size={16} />
                </button>
            </div>
        )
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 64 }}>

            {/* Chat Header */}
            <div style={{
                padding: '16px 24px',
                background: 'rgba(5,10,20,0.9)',
                backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Brain size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>
                            Chat · {resumeData.parsed?.personal_info?.name || 'Resume'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} className="pulse-dot" />
                            AI Active · RAG-powered · Bedrock Titan Embed v2 + OpenSearch k-NN
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => navigate('/analysis')}>
                        <BarChart3 size={14} /> Analysis
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
                {messages.map((msg, i) => (
                    <ChatMessage key={i} msg={msg} />
                ))}
                {loading && (
                    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Brain size={16} color="var(--accent)" />
                        </div>
                        <div style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border-1)',
                            borderRadius: '4px 14px 14px 14px'
                        }}>
                            <TypingIndicator />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Suggested Questions (shown when no user messages yet) */}
            {messages.length <= 1 && (
                <div style={{ padding: '0 24px 16px', maxWidth: 900, width: '100%', margin: '0 auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>
                        Suggested Questions
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                        {SUGGESTED_QUESTIONS.map(({ icon: Icon, text, color }) => (
                            <button
                                key={text}
                                onClick={() => sendMessage(text)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                                    color: 'rgba(240,246,255,0.7)', textAlign: 'left', fontSize: 13,
                                    transition: 'all 0.2s ease', fontFamily: 'Inter, sans-serif'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.color = '#f0f6ff' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(240,246,255,0.7)' }}
                            >
                                <Icon size={15} color={color} style={{ flexShrink: 0 }} />
                                {text}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Box */}
            <div style={{
                padding: '16px 24px 24px',
                background: 'rgba(5,10,20,0.8)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(255,255,255,0.06)'
            }}>
                <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <textarea
                            ref={inputRef}
                            id="chat-input"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything about this resume... (Press Enter to send)"
                            rows={1}
                            style={{
                                width: '100%', resize: 'none', overflowY: 'hidden',
                                padding: '14px 20px', borderRadius: 14,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
                                fontFamily: 'Inter, sans-serif', outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
                        />
                    </div>
                    <button
                        id="chat-send-btn"
                        className="btn-primary"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                        style={{ padding: '14px 20px', height: 50, flexShrink: 0, borderRadius: 14 }}
                    >
                        <Send size={18} />
                    </button>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                    Bedrock Titan Embed v2 → OpenSearch k-NN → Claude 3 Sonnet
                </div>
            </div>

            <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.7; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ai-message-content p { margin-bottom: 8px; }
        .ai-message-content ul { padding-left: 16px; }
        .ai-message-content li { margin-bottom: 4px; }
        .ai-message-content strong { color: var(--text-primary); }
        .ai-message-content code { background: rgba(59,130,246,0.12); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .ai-message-content h1, .ai-message-content h2, .ai-message-content h3 { color: var(--text-primary); margin: 8px 0 4px; font-weight: 700; }
      `}</style>
        </div>
    )
}
