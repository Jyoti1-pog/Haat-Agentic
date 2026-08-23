import { Router } from 'express'
import multer       from 'multer'
import { transcribe, speak } from '../services/voice.js'

const router = Router()

// Accept field named 'file' (matches frontend FormData key)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 },
})

// Curated Indian-accent voices
// First entry uses env var so operator can swap in any custom voice
const VOICES = [
  {
    id:      process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
    name:    'Aarav',
    desc:    'Warm Indian male',
    accent:  'Indian English',
    sample:  'Namaste! I found some beautiful products for you today.',
  },
  {
    id:      'EXAVITQu4vr4xnSDxMaL',
    name:    'Priya',
    desc:    'Clear Indian female',
    accent:  'Indian English',
    sample:  'Let me show you what I discovered from the local markets.',
  },
]

// ── POST /api/voice/transcribe ──────────────────────────────────────────────
router.post('/transcribe', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file received' })
    const mimeType = req.file.mimetype || 'audio/webm'
    const result   = await transcribe(req.file.buffer, mimeType)
    res.json(result)
  } catch (err) { next(err) }
})

// ── POST /api/voice/speak ───────────────────────────────────────────────────
router.post('/speak', async (req, res, next) => {
  try {
    const { text, voiceId } = req.body ?? {}
    if (!text?.trim()) return res.status(400).json({ error: '"text" is required' })
    const audioBuffer = await speak(text, voiceId)
    res.set('Content-Type', 'audio/mpeg')
    res.set('Content-Length', audioBuffer.length)
    res.send(audioBuffer)
  } catch (err) { next(err) }
})

// ── GET /api/voice/voices ───────────────────────────────────────────────────
router.get('/voices', (_req, res) => res.json(VOICES))

export default router
