import { createContext, useContext } from 'react'

export const ResumeContext = createContext({
    resumeData: null,
    setResumeData: () => { },
})

export const useResume = () => useContext(ResumeContext)
