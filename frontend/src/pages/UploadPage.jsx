import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
    Upload, CheckCircle, AlertCircle, Loader, Brain,
    ArrowRight, Cloud, Database, Cpu, RefreshCw
} from 'lucide-react'
import { useResume } from '../context/ResumeContext'
import axios from 'axios'

/**
 * Upload flow (4 steps):
 *  Step 1: POST /api/upload/presign  → get presigned S3 URL + resume_id
 *  Step 2: PUT <presigned_url>       → browser uploads directly to S3
 *  Step 3: POST /api/upload/complete → API publishes SQS job
 *  Step 4: Poll /api/status/<id>     → wait for ECS Worker to finish
 */

const STEPS = [
    { id: 1, label: 'Requesting presigned S3 URL', icon: Cloud, color: '#4f6ef7', detail: 'API generates a time-limited signed URL so your browser uploads directly to S3' },
    { id: 2, label: 'Uploading directly to S3', icon: Upload, color: '#8b5cf6', detail: 'Your file is sent straight to AWS S3 — never passes through the API server' },
    { id: 3, label: 'Queuing processing job via SQS', icon: RefreshCw, color: '#06b6d4', detail: 'A job is published to SQS. The ECS Worker picks it up asynchronously.' },
    { id: 4, label: 'Parsing with Bedrock (Claude 3)', icon: Cpu, color: '#22c55e', detail: 'ECS Worker calls Claude 3 Sonnet to extract structured resume data' },
    { id: 5, label: 'Indexing vectors in OpenSearch', icon: Database, color: '#f59e0b', detail: 'Chunks are embedded (Titan v2) and indexed for vector search' },
    { id: 6, label: 'Saving metadata to DynamoDB', icon: Database, color: '#8b5cf6', detail: 'Scores and metadata saved to DynamoDB' },
    { id: 7, label: 'Analysis complete!', icon: CheckCircle, color: '#22c55e', detail: 'Redirecting to your visual report…' },
]

export default function UploadPage() {
    const navigate = useNavigate()
    const { setResumeData } = useResume()

    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [error, setError] = useState(null)
    const [done, setDone] = useState(false)
    const [stepDetail, setStepDetail] = useState('')

    const onDrop = useCallback((accepted, rejected) => {
        if (rejected.length > 0) { setError('Only PDF, DOCX, DOC files are accepted (max 10 MB).'); return }
        setFile(accepted[0]); setError(null)
    }, [])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc']
        },
        maxFiles: 1, maxSize: 10 * 1024 * 1024
    })

    const advance = (n, detail = '') => { setCurrentStep(n); setStepDetail(detail) }
    const delay = ms => new Promise(r => setTimeout(r, ms))

    const handleUpload = async () => {
        if (!file) return
        setUploading(true); setError(null); setCurrentStep(0)

        try {
            // Step 1 — presign
            advance(1, STEPS[0].detail)
            const presignRes = await axios.post('/api/upload/presign', {
                filename: file.name,
                content_type: file.type || 'application/octet-stream'
            })
            const { resume_id, upload_url, s3_key } = presignRes.data

            // Step 2 — direct S3 PUT
            advance(2, STEPS[1].detail)
            await fetch(upload_url, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file
            })

            // Step 3 — notify API → SQS
            advance(3, STEPS[2].detail)
            await axios.post('/api/upload/complete', { resume_id, s3_key, filename: file.name })

            // Steps 4-6 — poll for worker
            advance(4, STEPS[3].detail)
            let result = null
            let poll = 0
            while (poll < 60) {   // max 5 min
                await delay(5000)
                const { data } = await axios.get(`/api/status/${resume_id}`)
                if (data.status === 'complete') { result = data.data; break }
                if (data.status === 'failed') throw new Error(data.error || 'Processing failed')
                if (poll === 3) advance(5, STEPS[4].detail)
                if (poll === 6) advance(6, STEPS[5].detail)
                poll++
            }
            if (!result) throw new Error('Processing timed out. Please try again.')

            advance(7, STEPS[6].detail)
            setResumeData(result)
            setDone(true)
            setTimeout(() => navigate('/analysis'), 1200)

        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.')
            setUploading(false); setCurrentStep(0)
        }
    }

    return (
        <div style={{ minHeight: '100vh', padding: '100px 24px 60px', maxWidth: 720, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
                <div className="section-title">UPLOAD</div>
                <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 12, letterSpacing: '-0.03em' }}>
                    Upload <span className="gradient-text">Resume</span>
                </h1>
                <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.7 }}>
                    Your file uploads directly to S3 via presigned URL. The API never sees the bytes — it only orchestrates.
                </p>
            </div>

            {/* Architecture mini diagram */}
            {!uploading && (
                <div className="glass-card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', overflow: 'hidden' }}>
                    {[
                        { label: 'Browser', color: '#818cf8' },
                        { label: '→ presign →', sm: true },
                        { label: 'API', color: '#a5b4fc' },
                        { label: '→ PUT →', sm: true },
                        { label: 'S3', color: '#4ade80' },
                        { label: '→ notify →', sm: true },
                        { label: 'SQS', color: '#fbbf24' },
                        { label: '→', sm: true },
                        { label: 'Worker + Bedrock', color: '#f87171' },
                    ].map(({ label, color, sm }, i) => (
                        <span key={i} style={{
                            fontSize: sm ? 11 : 11, fontWeight: sm ? 400 : 700,
                            color: color || 'var(--text-muted)', padding: sm ? '0 2px' : '3px 8px',
                            borderRadius: 5, background: sm ? 'transparent' : `${color}14`
                        }}>
                            {label}
                        </span>
                    ))}
                </div>
            )}

            {/* Dropzone */}
            {!uploading && !done && (
                <>
                    <div
                        id="resume-dropzone"
                        {...getRootProps()}
                        style={{
                            border: `2px dashed ${isDragActive ? 'var(--accent)' : file ? '#22c55e' : 'var(--glass-border-h)'}`,
                            borderRadius: 16, padding: '52px 36px', textAlign: 'center', cursor: 'pointer',
                            background: isDragActive ? 'var(--accent-dim)' : file ? 'rgba(34,197,94,0.04)' : 'var(--glass-bg)',
                            transition: 'all 0.22s ease', marginBottom: 20
                        }}
                    >
                        <input {...getInputProps()} id="resume-file-input" />
                        <div style={{
                            width: 64, height: 64, borderRadius: 16,
                            background: file ? 'rgba(34,197,94,0.10)' : 'var(--accent-dim)',
                            border: `1px solid ${file ? 'rgba(34,197,94,0.25)' : 'var(--accent-border)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 18px'
                        }}>
                            {file ? <CheckCircle size={28} color="#22c55e" /> : <Upload size={28} color="var(--accent)" />}
                        </div>
                        {file ? (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>✓ {file.name}</div>
                                <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace</div>
                            </div>
                        ) : (
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                                    {isDragActive ? 'Drop it here' : 'Drag & drop your resume'}
                                </div>
                                <div style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 14 }}>or click to browse</div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                    {['PDF', 'DOCX', 'DOC'].map(e => <span key={e} className="tag tag-blue">{e}</span>)}
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div style={{
                            display: 'flex', gap: 10, padding: '12px 16px', marginBottom: 16,
                            background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 'var(--radius-md)'
                        }}>
                            <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                            <span style={{ color: '#f87171', fontSize: 13 }}>{error}</span>
                        </div>
                    )}

                    <button
                        id="upload-analyze-btn"
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={!file}
                        style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15 }}
                    >
                        <Brain size={18} />
                        Analyze with AWS Bedrock
                        <ArrowRight size={16} />
                    </button>
                </>
            )}

            {/* Progress */}
            {uploading && (
                <div className="glass-card" style={{ padding: 36 }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        {done
                            ? <CheckCircle size={48} color="#22c55e" style={{ margin: '0 auto 12px' }} />
                            : <div style={{ width: 48, height: 48, border: '3px solid var(--surface-3)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                        }
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                            {done ? 'Complete — redirecting…' : 'AWS pipeline running…'}
                        </h3>
                        {stepDetail && !done && (
                            <p style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 440, margin: '6px auto 0', lineHeight: 1.6 }}>{stepDetail}</p>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {STEPS.map(step => {
                            const done_ = currentStep > step.id
                            const active = currentStep === step.id
                            const Icon = step.icon
                            return (
                                <div key={step.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '11px 16px', borderRadius: 10,
                                    background: active ? `${step.color}0e` : done_ ? 'rgba(34,197,94,0.05)' : 'transparent',
                                    border: `1px solid ${active ? `${step.color}30` : done_ ? 'rgba(34,197,94,0.12)' : 'var(--glass-border)'}`,
                                    transition: 'all 0.28s ease'
                                }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                        background: done_ ? 'rgba(34,197,94,0.10)' : active ? `${step.color}15` : 'var(--glass-bg)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {done_ ? <CheckCircle size={15} color="#22c55e" />
                                            : active ? <Loader size={15} color={step.color} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <Icon size={15} color="var(--text-3)" />}
                                    </div>
                                    <span style={{
                                        fontSize: 13, flex: 1,
                                        fontWeight: active ? 600 : 400,
                                        color: done_ ? '#4ade80' : active ? 'var(--text-1)' : 'var(--text-3)'
                                    }}>
                                        {step.label}
                                    </span>
                                    {active && <div className="status-dot live" />}
                                </div>
                            )
                        })}
                    </div>

                    <div style={{
                        marginTop: 20, padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)',
                        fontSize: 12, color: 'rgba(245,158,11,0.75)', lineHeight: 1.6
                    }}>
                        <strong>AWS Learning:</strong> Step 2 sends bytes directly from the browser to S3 via a presigned URL — the API server never touches your file. Steps 4–6 run inside a separate ECS Worker consuming SQS messages.
                    </div>

                    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </div>
            )}
        </div>
    )
}
