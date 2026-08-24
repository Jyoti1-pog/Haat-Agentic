/**
 * Vercel serverless entry point.
 *
 * Vercel invokes the default export as a request handler, so the whole Express
 * app is handed over as-is — the same app that binds a port locally. There is
 * deliberately no logic here: a deployment target should not be a place where
 * behaviour differs from what was tested.
 *
 * `vercel.json` rewrites every /api/* path to this function, and the Express
 * router matches on the original URL, so routes are identical in both places.
 */

export { default } from '../backend/server.js'
