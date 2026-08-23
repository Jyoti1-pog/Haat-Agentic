import fetch from 'node-fetch'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const BASE        = 'https://api.elevenlabs.io/v1'
const DEFAULT_VID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'

function getSDK() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set')
  return new ElevenLabsClient({ apiKey })
}

// ── Speech-to-Text ──────────────────────────────────────────────────────────
// Uses the SDK — native FormData + node-fetch fails for binary multipart.
export async function transcribe(audioBuffer, mimeType = 'audio/webm') {
  try {
    const sdk  = getSDK()
    const mime = mimeType.split(';')[0].trim()
    const ext  = mime.split('/')[1] ?? 'webm'
    const file = new File([audioBuffer], `recording.${ext}`, { type: mime })

    const result = await sdk.speechToText.convert({
      file:         file,
      modelId:      'scribe_v2',
      languageCode: 'en',
    })

    return { text: result.text ?? '' }
  } catch (err) {
    console.error('[Voice] transcribe error:', err.message)
    return { text: '', error: err.message }
  }
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────
// eleven_multilingual_v2 gives best Indian-accent fidelity.
// Higher similarity_boost preserves the voice's accent characteristics.
export async function speak(text, voiceId = DEFAULT_VID) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set')

  const response = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key':   apiKey,
    },
    body: JSON.stringify({
      text:     text.slice(0, 400),
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability:        0.60,
        similarity_boost: 0.85,
        style:            0.25,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`ElevenLabs TTS ${response.status}: ${detail}`)
  }

  const buf = await response.arrayBuffer()
  return Buffer.from(buf)
}
