import { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function ParticleBackground() {
    const canvasRef = useRef(null)
    const { theme } = useTheme()
    const rafRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')

        let W = window.innerWidth
        let H = window.innerHeight
        canvas.width = W
        canvas.height = H

        const N = Math.min(Math.floor(W * H / 14000), 80)
        const isDark = theme === 'dark'

        const particles = Array.from({ length: N }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            r: Math.random() * 1.6 + 0.4,
            alpha: Math.random() * 0.6 + 0.15,
            pulse: Math.random() * Math.PI * 2,
        }))

        const connections = []

        const LINK_DIST = 130

        function draw(t) {
            ctx.clearRect(0, 0, W, H)

            const color = isDark
                ? '140, 160, 255'
                : '74, 94, 240'

            // Update + draw particles
            for (const p of particles) {
                p.x += p.vx
                p.y += p.vy
                p.pulse += 0.012
                const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse))

                if (p.x < 0) p.x = W
                if (p.x > W) p.x = 0
                if (p.y < 0) p.y = H
                if (p.y > H) p.y = 0

                ctx.beginPath()
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(${color}, ${a})`
                ctx.fill()
            }

            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x
                    const dy = particles[i].y - particles[j].y
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist < LINK_DIST) {
                        const a = (1 - dist / LINK_DIST) * 0.15
                        ctx.beginPath()
                        ctx.moveTo(particles[i].x, particles[i].y)
                        ctx.lineTo(particles[j].x, particles[j].y)
                        ctx.strokeStyle = `rgba(${color}, ${a})`
                        ctx.lineWidth = 0.5
                        ctx.stroke()
                    }
                }
            }

            rafRef.current = requestAnimationFrame(draw)
        }

        rafRef.current = requestAnimationFrame(draw)

        const onResize = () => {
            W = window.innerWidth
            H = window.innerHeight
            canvas.width = W
            canvas.height = H
        }
        window.addEventListener('resize', onResize)

        return () => {
            cancelAnimationFrame(rafRef.current)
            window.removeEventListener('resize', onResize)
        }
    }, [theme])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 0.55,
            }}
        />
    )
}
