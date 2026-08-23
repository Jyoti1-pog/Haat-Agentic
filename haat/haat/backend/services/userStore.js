/**
 * userStore.js — user CRUD backed by SQLite (via db.js)
 *
 * All functions are synchronous — better-sqlite3 is sync, bcrypt
 * comparisons happen in the auth route so this layer stays simple.
 *
 * Column ↔ JS field mapping
 * ─────────────────────────
 *   password_hash  ↔  passwordHash
 *   country_code   ↔  countryCode
 *   home_state     ↔  homeState
 *   budget_range   ↔  budgetRange
 *   created_at     ↔  createdAt   (epoch ms)
 *   updated_at     ↔  updatedAt
 *   onboarded      ↔  onboarded   (0/1 → boolean)
 *   dietary        ↔  dietary     (JSON string ↔ string[])
 *   occasions      ↔  occasions   (JSON string ↔ string[])
 */

import crypto from 'crypto'
import db      from './db.js'

// ── Prepared statements ───────────────────────────────────────────────────────
const stmtInsert = db.prepare(`
  INSERT INTO users
    (id, email, password_hash, name, country, country_code, home_state,
     dietary, budget_range, occasions, onboarded, created_at, updated_at)
  VALUES
    (@id, @email, @password_hash, @name, @country, @country_code, @home_state,
     @dietary, @budget_range, @occasions, @onboarded, @created_at, @updated_at)
`)

const stmtByEmail = db.prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`)
const stmtById    = db.prepare(`SELECT * FROM users WHERE id = ? LIMIT 1`)

const stmtUpdate  = db.prepare(`
  UPDATE users SET
    name         = @name,
    country      = @country,
    country_code = @country_code,
    home_state   = @home_state,
    dietary      = @dietary,
    budget_range = @budget_range,
    occasions    = @occasions,
    onboarded    = @onboarded,
    updated_at   = @updated_at
  WHERE id = @id
`)

// ── Row ↔ JS object ──────────────────────────────────────────────────────────
function rowToUser(row) {
  if (!row) return null
  return {
    id:           row.id,
    email:        row.email,
    passwordHash: row.password_hash,
    name:         row.name,
    country:      row.country,
    countryCode:  row.country_code,
    homeState:    row.home_state,
    dietary:      JSON.parse(row.dietary  ?? '[]'),
    budgetRange:  row.budget_range,
    occasions:    JSON.parse(row.occasions ?? '[]'),
    onboarded:    row.onboarded === 1,
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export function createUser({ email, passwordHash, name }) {
  const id  = crypto.randomUUID()
  const now = Date.now()

  stmtInsert.run({
    id,
    email:        email.toLowerCase().trim(),
    password_hash: passwordHash,
    name:         (name?.trim() || email.split('@')[0]),
    country:      null,
    country_code:  null,
    home_state:   null,
    dietary:      '[]',
    budget_range:  null,
    occasions:    '[]',
    onboarded:    0,
    created_at:   now,
    updated_at:   now,
  })

  return findById(id)
}

export function findByEmail(email) {
  return rowToUser(stmtByEmail.get(email))
}

export function findById(id) {
  return rowToUser(stmtById.get(id))
}

export function updateUser(id, updates) {
  const user = findById(id)
  if (!user) return null

  // Merge updates into existing user
  const merged = { ...user, ...updates, id }

  stmtUpdate.run({
    id,
    name:         merged.name,
    country:      merged.country      ?? null,
    country_code: merged.countryCode  ?? null,
    home_state:   merged.homeState    ?? null,
    dietary:      JSON.stringify(merged.dietary   ?? []),
    budget_range: merged.budgetRange  ?? null,
    occasions:    JSON.stringify(merged.occasions ?? []),
    onboarded:    merged.onboarded ? 1 : 0,
    updated_at:   Date.now(),
  })

  return findById(id)
}

// Strip passwordHash for API responses
export function publicProfile(user) {
  const { passwordHash, ...safe } = user
  return safe
}
