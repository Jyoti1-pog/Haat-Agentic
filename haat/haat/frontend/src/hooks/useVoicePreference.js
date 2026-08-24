import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'haat_voice'
const VOICES = [
  {
    id:     'pNInz6obpgDQGcFmaJgB',
    name:   'Aarav',
    desc:   'Warm Indian male',
    sample: 'Namaste! I found some beautiful products for you today.',
  },
  {
    id:     'EXAVITQu4vr4xnSDxMaL',
    name:   'Priya',
    desc:   'Clear Indian female',
    sample: 'Let me show you what I discovered from the local markets.',
  },
]

export function useVoicePreference() {
  const [voiceId, setVoiceId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || VOICES[0].id } catch { return VOICES[0].id }
  })

  const selectVoice = useCallback((id) => {
    setVoiceId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }, [])

  const selectedVoice = VOICES.find(v => v.id === voiceId) ?? VOICES[0]

  return { voiceId, voices: VOICES, selectedVoice, selectVoice }
}
