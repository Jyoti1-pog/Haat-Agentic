import { createContext, useContext, useState, useCallback, useRef } from 'react'

const LoadingCtx = createContext(null)

export function LoadingProvider({ children }) {
  const [progress, setProgress] = useState(0)
  const [visible,  setVisible]  = useState(false)
  const t1 = useRef(null)
  const t2 = useRef(null)
  const t3 = useRef(null)

  const startLoading = useCallback(() => {
    clearTimeout(t1.current); clearTimeout(t2.current); clearTimeout(t3.current)
    setVisible(true)
    setProgress(30)
    t1.current = setTimeout(() => setProgress(55), 400)
    t2.current = setTimeout(() => setProgress(78), 1200)
  }, [])

  const stopLoading = useCallback(() => {
    clearTimeout(t1.current); clearTimeout(t2.current)
    setProgress(100)
    t3.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setProgress(0), 50)
    }, 380)
  }, [])

  return (
    <LoadingCtx.Provider value={{ startLoading, stopLoading, progress, visible }}>
      {children}
    </LoadingCtx.Provider>
  )
}

export function useLoading() {
  const ctx = useContext(LoadingCtx)
  if (!ctx) throw new Error('useLoading must be used inside LoadingProvider')
  return ctx
}
