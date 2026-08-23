import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import voiceRouter from '../routes/voice.js'
import searchRouter from '../routes/search.js'
import agentRouter from '../routes/agent.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'haat-backend', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/voice', voiceRouter)
app.use('/api/search', searchRouter)
app.use('/api/agent', agentRouter)

// Placeholder routes — to be expanded
app.get('/api/markets', (req, res) => {
  res.json({ message: 'Markets endpoint — coming soon' })
})

app.get('/api/products', (req, res) => {
  res.json({ message: 'Products endpoint — coming soon' })
})

app.listen(PORT, () => {
  console.log(`\n🛕  Haat backend running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})
