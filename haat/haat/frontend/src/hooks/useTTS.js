/**
 * useTTS — Text-to-Speech via /api/voice/speak (ElevenLabs)
 *
 * Usage:
 *   const { speak, stop, speaking } = useTTS({ voiceId: 'pNInz6obpgDQGcFmaJgB' })
 *   speak('Hello!')     // fetches audio from backend, plays it
 *   stop()              // interrupts playback
 */

import { useState, useRef, useCallback, useEffect } from 'react'

// Strip markdown so ElevenLabs doesn't read "asterisk asterisk bold asterisk asterisk"
function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')            // headers
    .replace(/\*{1,2}(.+?)\*{1,2}/g, '$1') // bold / italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')    // code
    .replace(/\|[^\n]+\|/g, '')           // table rows
    .replace(/[-*]\s+/g, '')              // list markers
    .replace(/\n{2,}/g, '. ')             // paragraph breaks → pause
    .replace(/\n/g, ' ')
    .replace(/---/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Truncate to a natural sentence boundary under maxLen chars
function truncateForSpeech(text, maxLen = 500) {
  const stripped = stripMarkdown(text)
  if (stripped.length <= maxLen) return stripped
  // Cut at last sentence end before limit
  const cut    = stripped.slice(0, maxLen)
  const lastDot = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return lastDot > 100 ? cut.slice(0, lastDot + 1) : cut
}

export function useTTS({ voiceId } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const audioRef   = useRef(null)
  const abortRef   = useRef(null)

  useEffect(() => () => stop(), [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(async (rawText) => {
    stop()                                 // interrupt any current speech

    const text = truncateForSpeech(rawText)
    if (!text) return

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      setSpeaking(true)
      const res = await fetch('/api/voice/speak', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text, voiceId }),
        signal:  ctrl.signal,
      })

      if (!res.ok) throw new Error(`TTS ${res.status}`)

      const blob = await res.blob()
      if (ctrl.signal.aborted) return    // stopped while fetching

      const url   = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setSpeaking(false)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setSpeaking(false)
      }

      await audio.play()
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[TTS] speak failed:', err.message)
      }
      setSpeaking(false)
    }
  }, [stop, voiceId])

  return { speak, stop, speaking }
}
