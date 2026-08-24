/**
 * useVoiceRecorder — records audio via MediaRecorder, transcribes via ElevenLabs Scribe (Pro)
 *
 * states: 'idle' | 'requesting' | 'recording' | 'processing'
 * volume: 0–100 real-time amplitude for UI rings
 */
import { useState, useRef, useCallback, useEffect } from 'react'

export function useVoiceRecorder({ onTranscript, onError } = {}) {
  const [state,  setState]  = useState('idle')
  const [volume, setVolume] = useState(0)

  const mrRef      = useRef(null)   // MediaRecorder
  const streamRef  = useRef(null)
  const analyserRef= useRef(null)
  const rafRef     = useRef(null)
  const chunksRef  = useRef([])

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setVolume(0)
    try { mrRef.current?.stop() } catch (_) {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    analyserRef.current = null
    mrRef.current = null
  }

  // Runs every animation frame to read mic amplitude
  function tick() {
    if (!analyserRef.current) return
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(buf)
    const avg = buf.reduce((s, v) => s + v, 0) / buf.length
    setVolume(Math.min(100, avg * 1.8))
    rafRef.current = requestAnimationFrame(tick)
  }

  const start = useCallback(async () => {
    if (state !== 'idle') return
    setState('requesting')
    chunksRef.current = []

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      setState('idle')
      if (err.name === 'NotAllowedError') onError?.('Microphone permission denied — allow it in browser settings')
      else onError?.(err.message ?? 'Cannot access microphone')
      return
    }

    streamRef.current = stream

    // Volume analyser
    try {
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const an  = ctx.createAnalyser()
      an.fftSize = 256
      an.smoothingTimeConstant = 0.7
      src.connect(an)
      analyserRef.current = an
      rafRef.current = requestAnimationFrame(tick)
    } catch (_) { /* visualisation optional */ }

    // Pick best mime type
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', '']
      .find(m => !m || MediaRecorder.isTypeSupported(m))

    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {})
    mrRef.current = mr

    mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }

    mr.onstop = async () => {
      // Stop visualisation
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      setVolume(0)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      analyserRef.current = null

      if (!chunksRef.current.length) { setState('idle'); return }

      setState('processing')

      const mimeType = mr.mimeType || 'audio/webm'
      const ext      = mimeType.includes('ogg') ? 'ogg' : 'webm'
      const blob     = new Blob(chunksRef.current, { type: mimeType })

      try {
        const form = new FormData()
        form.append('file', blob, `recording.${ext}`)
        const res  = await fetch('/api/voice/transcribe', { method: 'POST', body: form })
        const data = await res.json()

        if (data.text?.trim()) {
          onTranscript?.(data.text.trim())
        } else if (data.error) {
          onError?.(`Transcription error: ${data.error}`)
        } else {
          onError?.("Didn't catch that — try speaking again")
        }
      } catch (err) {
        onError?.(err.message ?? 'Transcription failed')
      } finally {
        setState('idle')
      }
    }

    mr.start(200)
    setState('recording')
  }, [state, onTranscript, onError])

  const stop = useCallback(() => {
    if (mrRef.current?.state === 'recording') mrRef.current.stop()
  }, [])

  const toggle = useCallback(() => {
    if (state === 'idle')      start()
    else if (state === 'recording') stop()
  }, [state, start, stop])

  return { state, volume, toggle, start, stop, isSupported: true }
}
