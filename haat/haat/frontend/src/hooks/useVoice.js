import { useState, useRef, useCallback, useEffect } from 'react'

const API = 'http://localhost:3001/api'

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  for (const t of types) {
    try { if (MediaRecorder.isTypeSupported(t)) return t } catch {}
  }
  return ''
}

// ── Error types ─────────────────────────────────────────────────────────────
export const VoiceError = {
  MIC_DENIED:      'MIC_DENIED',       // NotAllowedError
  MIC_UNAVAILABLE: 'MIC_UNAVAILABLE',  // No mic hardware
  TRANSCRIBE_FAIL: 'TRANSCRIBE_FAIL',  // STT error
  SPEAK_FAIL:      'SPEAK_FAIL',       // TTS error
  GENERIC:         'GENERIC',
}

export function useVoice() {
  const [recording,   setRecording]   = useState(false)
  const [processing,  setProcessing]  = useState(false)
  const [playing,     setPlaying]     = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [level,       setLevel]       = useState(0)
  const [error,       setError]       = useState(null)      // { type, message }
  const [errorType,   setErrorType]   = useState(null)

  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const streamRef     = useRef(null)
  const audioCtxRef   = useRef(null)
  const analyserRef   = useRef(null)
  const animFrameRef  = useRef(null)
  const playCtxRef    = useRef(null)
  const playSourceRef = useRef(null)

  useEffect(() => () => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    playCtxRef.current?.close().catch(() => {})
  }, [])

  function setVoiceError(type, message) {
    setError(message)
    setErrorType(type)
  }

  function clearError() {
    setError(null)
    setErrorType(null)
  }

  // ── transcribe ─────────────────────────────────────────────────────────────
  const transcribe = useCallback(async (blob, mimeType) => {
    setProcessing(true)
    clearError()
    try {
      const form = new FormData()
      // Field must be named 'file' — backend uses upload.single('file')
      // Filename with extension is critical for ElevenLabs to detect format
      form.append('file', blob, 'recording.webm')
      // Do NOT set Content-Type — browser sets it with correct multipart boundary
      const res = await fetch(`${API}/voice/transcribe`, { method: 'POST', body: form })

      if (!res.ok) throw new Error(`Transcription failed: ${res.status}`)
      const data = await res.json()
      if (data.error && !data.text) {
        throw new Error(data.error)
      }
      const text = data.text ?? ''
      setTranscript(text)
      return text
    } catch (err) {
      setVoiceError(VoiceError.TRANSCRIBE_FAIL, "Couldn't hear that clearly — try typing your search")
      setTranscript('')
      return ''
    } finally {
      setProcessing(false)
    }
  }, [])

  // ── startRecording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    clearError()
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      // Audio level analyser
      const ctx      = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize               = 128
      analyser.smoothingTimeConstant = 0.7
      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setLevel(Math.min(100, Math.round(avg * 2.2)))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()

      // MediaRecorder
      const mimeType = getSupportedMimeType()
      const options  = mimeType ? { mimeType } : {}
      const recorder = new MediaRecorder(stream, options)
      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current)
        setLevel(0)
        stream.getTracks().forEach(t => t.stop())
        ctx.close().catch(() => {})
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        await transcribe(blob, mimeType || 'audio/webm')
      }

      recorder.start(100)
      recorderRef.current = recorder
      setRecording(true)

    } catch (err) {
      setRecording(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError(VoiceError.MIC_DENIED, 'Microphone access needed for voice search. Please allow in browser settings.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setVoiceError(VoiceError.MIC_UNAVAILABLE, 'No microphone found. Please connect a microphone and try again.')
      } else {
        setVoiceError(VoiceError.GENERIC, err.message)
      }
    }
  }, [transcribe])

  // ── stopRecording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  // ── speak ──────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text, voiceId) => {
    clearError()
    // Stop any current playback
    try { playSourceRef.current?.stop() } catch {}
    try { await playCtxRef.current?.close() } catch {}

    try {
      const res = await fetch(`${API}/voice/speak`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(voiceId ? { text, voiceId } : { text }),
      })
      if (!res.ok) throw new Error(`TTS failed: ${res.status}`)

      const arrayBuf = await res.arrayBuffer()
      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      playCtxRef.current = ctx

      // Resume context — required after browser autoplay policy blocks it
      if (ctx.state === 'suspended') await ctx.resume()

      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      const source   = ctx.createBufferSource()
      source.buffer  = audioBuf
      source.connect(ctx.destination)
      playSourceRef.current = source

      setPlaying(true)
      source.start()
      source.onended = () => {
        setPlaying(false)
        ctx.close().catch(() => {})
      }
    } catch (err) {
      setPlaying(false)
      // Silently degrade — caller should show toast if needed
      setVoiceError(VoiceError.SPEAK_FAIL, err.message)
    }
  }, [])

  const stopPlaying = useCallback(() => {
    try { playSourceRef.current?.stop() } catch {}
    setPlaying(false)
  }, [])

  return {
    recording,
    processing,
    playing,
    transcript,
    level,
    error,
    errorType,
    clearError,
    startRecording,
    stopRecording,
    speak,
    stopPlaying,
  }
}
