import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import Navbar from './components/Navbar'
import ParticleBackground from './components/ParticleBackground'
import LandingPage from './pages/LandingPage'
import UploadPage from './pages/UploadPage'
import AnalysisPage from './pages/AnalysisPage'
import ChatPage from './pages/ChatPage'
import HistoryPage from './pages/HistoryPage'
import { ResumeContext } from './context/ResumeContext'
import { ThemeProvider } from './context/ThemeContext'

export default function App() {
    const [resumeData, setResumeData] = useState(null)

    return (
        <ThemeProvider>
            <ResumeContext.Provider value={{ resumeData, setResumeData }}>
                <ParticleBackground />
                <Navbar />
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/upload" element={<UploadPage />} />
                    <Route path="/analysis" element={<AnalysisPage />} />
                    <Route path="/chat" element={<ChatPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </ResumeContext.Provider>
        </ThemeProvider>
    )
}
