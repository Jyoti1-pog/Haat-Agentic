/**
 * db.js — SQLite database for haat
 *
 * Single-file database stored at:  backend/data/haat.db
 *
 * Tables
 * ──────
 *   users    — registered users + profiles
 *   sessions — chat sessions (history, last products, …)
 *
 * We use `better-sqlite3` which is fully synchronous and ships prebuilt
 * binaries for Windows/Mac/Linux — no compilation required.
 */

import Database  from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../data')
const DB_PATH   = join(DATA_DIR, 'haat.db')

// Ensure data/ directory exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// Open (or create) the database file
const db = new Database(DB_PATH)

// ── Performance settings ─────────────────────────────────────────────────────
db.pragma('journal_mode = WAL')   // concurrent reads + writes
db.pragma('foreign_keys = ON')
db.pragma('synchronous = NORMAL') // good balance: speed vs durability

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT    PRIMARY KEY,
    email         TEXT    UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    name          TEXT,
    country       TEXT,
    country_code  TEXT,
    home_state    TEXT,
    dietary       TEXT    NOT NULL DEFAULT '[]',
    budget_range  TEXT,
    occasions     TEXT    NOT NULL DEFAULT '[]',
    onboarded     INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT    PRIMARY KEY,
    user_id       TEXT,
    history       TEXT    NOT NULL DEFAULT '[]',
    last_query    TEXT,
    last_products TEXT,
    last_source   TEXT,
    cart          TEXT,
    created_at    INTEGER NOT NULL,
    updated_at    INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);
`)

// Add columns that might not exist in older DB files (safe no-op if already exists)
try { db.exec(`ALTER TABLE sessions ADD COLUMN cart TEXT`) } catch (_) {}

console.log(`[DB] SQLite ready → ${DB_PATH}`)

export default db
