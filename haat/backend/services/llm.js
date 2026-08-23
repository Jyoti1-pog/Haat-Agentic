/**
 * llm.js — the model behind the AI buyer, whichever one that is
 *
 * The agent surface should not care who supplies the reasoning. This wraps
 * OpenAI and Anthropic behind one tool-calling loop so the commerce code stays
 * provider-agnostic: tools are declared once in plain JSON Schema and translated
 * at the boundary.
 *
 * Selection is by key, not by config. OPENAI_API_KEY wins if both are present,
 * because that is the one an operator is most likely to have set deliberately;
 * set LLM_PROVIDER to force either.
 *
 * The loop is the same shape in both cases:
 *   ask → model returns tool calls → we execute them → feed results back →
 *   repeat until the model answers in prose or we hit the turn ceiling.
 */

const MAX_TURNS = 12

export function provider() {
  const forced = process.env.LLM_PROVIDER?.toLowerCase()
  if (forced === 'openai' || forced === 'anthropic') return forced
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  return null
}

export function modelName() {
  return provider() === 'openai'
    ? (process.env.OPENAI_MODEL ?? 'gpt-4o')
    : (process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-6')
}

export const isConfigured = () => provider() !== null

/** A short label for the ledger and the UI, e.g. "openai · gpt-4o". */
export const describe = () => (isConfigured() ? `${provider()} · ${modelName()}` : 'not configured')

// Clients are created lazily so an unset key is a runtime answer, not a boot crash.
let openaiClient = null
let anthropicClient = null

async function openai() {
  if (!openaiClient) {
    const { default: OpenAI } = await import('openai')
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

async function anthropic() {
  if (!anthropicClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

/**
 * Runs a tool-calling conversation to completion.
 *
 * @param {object}   args
 * @param {string}   args.system      system prompt
 * @param {Array}    args.history     provider-native messages from a previous run, or []
 * @param {string}   args.input       what the user just said
 * @param {Array}    args.tools       [{ name, description, parameters }] — plain JSON Schema
 * @param {Function} args.execute     async (name, args) => result object
 * @param {Function} [args.onToolCall] (name, args, result) => void, for logging
 * @returns {{ reply, messages, toolCalls, provider, model }}
 */
export async function runToolLoop({ system, history = [], input, tools, execute, onToolCall }) {
  if (!isConfigured()) throw new Error('No LLM provider configured')
  return provider() === 'openai'
    ? runOpenAI({ system, history, input, tools, execute, onToolCall })
    : runAnthropic({ system, history, input, tools, execute, onToolCall })
}

// ── OpenAI ───────────────────────────────────────────────────────────────────
async function runOpenAI({ system, history, input, tools, execute, onToolCall }) {
  const client = await openai()
  const model = modelName()

  const messages = [
    { role: 'system', content: system },
    ...history.filter(m => m.role !== 'system'),
    { role: 'user', content: input },
  ]

  const spec = tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))

  const toolCalls = []
  let reply = ''

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.chat.completions.create({
      model, messages, tools: spec, tool_choice: 'auto', temperature: 0.2,
    })

    const msg = res.choices[0].message
    messages.push(msg)

    if (msg.content?.trim()) reply = msg.content.trim()
    if (!msg.tool_calls?.length) break

    for (const call of msg.tool_calls) {
      // Always parse rather than string-match: models vary in how they escape.
      let args = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch { /* malformed → empty */ }

      const result = await execute(call.function.name, args)
      toolCalls.push({ name: call.function.name, input: args, status: result?.status })
      onToolCall?.(call.function.name, args, result)

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })
    }
  }

  return { reply, messages: messages.filter(m => m.role !== 'system'), toolCalls, provider: 'openai', model }
}

// ── Anthropic ────────────────────────────────────────────────────────────────
async function runAnthropic({ system, history, input, tools, execute, onToolCall }) {
  const client = await anthropic()
  const model = modelName()

  const messages = [...history, { role: 'user', content: input }]

  const spec = tools.map(t => ({
    name: t.name, description: t.description, input_schema: t.parameters,
  }))

  const toolCalls = []
  let reply = ''

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model, max_tokens: 8000, system, tools: spec, messages,
    })

    messages.push({ role: 'assistant', content: res.content })

    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    if (text) reply = text
    if (res.stop_reason !== 'tool_use') break

    const results = []
    for (const use of res.content.filter(b => b.type === 'tool_use')) {
      const args = use.input ?? {}
      const result = await execute(use.name, args)
      toolCalls.push({ name: use.name, input: args, status: result?.status })
      onToolCall?.(use.name, args, result)

      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: JSON.stringify(result),
        ...(result?.status === 'error' ? { is_error: true } : {}),
      })
    }
    messages.push({ role: 'user', content: results })
  }

  return { reply, messages, toolCalls, provider: 'anthropic', model }
}
