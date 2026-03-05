import { createContext, useContext, useState, useEffect } from 'react'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('rg-theme') || 'dark'
    })

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('rg-theme', theme)
    }, [theme])

    const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

    return (
        <ThemeCtx.Provider value={{ theme, toggle }}>
            {children}
        </ThemeCtx.Provider>
    )
}

export const useTheme = () => useContext(ThemeCtx)
