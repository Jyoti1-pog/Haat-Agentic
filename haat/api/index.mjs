/**
 * Vercel serverless entry point.
 *
 * The Express app is handed over as-is — the same app that binds a port locally,
 * so behaviour cannot drift between what was tested and what is deployed.
 *
 * The .mjs extension is load-bearing. This file sits at the repository root,
 * where package.json has no "type": "module", so a .js file here would be read
 * as CommonJS and `export` would be a syntax error that kills the function
 * before it runs a line. .mjs is ESM regardless of any package.json above it.
 *
 * The app is imported lazily inside the handler rather than at module scope. A
 * failure at module scope surfaces as FUNCTION_INVOCATION_FAILED with no detail
 * — an opaque wall. Imported here, the same failure becomes a JSON response
 * naming the module and the reason, which is the difference between a two-minute
 * fix and an afternoon of guessing.
 */

let appPromise = null

function loadApp() {
  appPromise ??= import('../backend/server.js').then(m => m.default)
  return appPromise
}

export default async function handler(req, res) {
  try {
    const app = await loadApp()
    if (typeof app !== 'function') {
      throw new Error('backend/server.js did not export an Express app as its default')
    }
    return app(req, res)
  } catch (err) {
    // Reset so a transient failure does not poison every later invocation.
    appPromise = null

    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({
      error: 'boot_failed',
      message: err?.message ?? String(err),
      code: err?.code ?? null,
      // The first frames are what identify the module that actually failed.
      stack: (err?.stack ?? '').split('\n').slice(0, 8),
      hint: 'A missing module means the function bundle lacks a dependency; ' +
            'an ENOENT means vercel.json needs includeFiles for that path.',
    }, null, 2))
  }
}
