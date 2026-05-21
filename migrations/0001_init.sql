-- Phase 2: D1 schema

-- ─── sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT    PRIMARY KEY,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
  last_active_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  ip_hash           TEXT,
  country           TEXT,
  region            TEXT,
  city              TEXT,
  asn               INTEGER,
  asn_name          TEXT,
  user_agent_family TEXT,
  referrer          TEXT,
  landing_path      TEXT,
  csrf_secret       TEXT,
  message_count     INTEGER NOT NULL DEFAULT 0,
  intent            TEXT,
  intent_confidence REAL,
  ended_at          INTEGER
);

-- ─── messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content     TEXT    NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  model       TEXT,
  latency_ms  INTEGER,
  feedback    TEXT    -- 'thumbs_up' | 'thumbs_down' | null
);

-- ─── leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id       TEXT    REFERENCES sessions(id) ON DELETE SET NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  name             TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  phone            TEXT,
  organization     TEXT,
  reason           TEXT,
  intent           TEXT,
  opt_in_email     INTEGER NOT NULL DEFAULT 0,  -- boolean: 0/1
  follow_up_status TEXT    NOT NULL DEFAULT 'pending',
  notes            TEXT,
  email_sent       INTEGER NOT NULL DEFAULT 0   -- boolean: 0/1
);

-- ─── summaries ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS summaries (
  session_id  TEXT    PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  summary     TEXT    NOT NULL,
  key_topics  TEXT,   -- JSON array of strings
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  model       TEXT
);

-- ─── analytics_events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT    REFERENCES sessions(id) ON DELETE SET NULL,
  event_type  TEXT    NOT NULL,
  payload     TEXT,   -- JSON blob
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ─── daily_metrics ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  date             TEXT    PRIMARY KEY,  -- YYYY-MM-DD
  total_visitors   INTEGER NOT NULL DEFAULT 0,
  unique_visitors  INTEGER NOT NULL DEFAULT 0,
  chat_sessions    INTEGER NOT NULL DEFAULT 0,
  chat_messages    INTEGER NOT NULL DEFAULT 0,
  leads            INTEGER NOT NULL DEFAULT 0,
  leads_by_intent  TEXT,   -- JSON object  { intent: count }
  top_questions    TEXT,   -- JSON array   [{ q, count }]
  countries        TEXT,   -- JSON object  { countryCode: count }
  conversion_rate  REAL    NOT NULL DEFAULT 0.0
);

-- ─── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_created_at      ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_ip_hash         ON sessions(ip_hash);
CREATE INDEX IF NOT EXISTS idx_messages_session_id      ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_session_id         ON leads(session_id);
CREATE INDEX IF NOT EXISTS idx_leads_email              ON leads(email);
CREATE INDEX IF NOT EXISTS idx_analytics_session_id     ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type     ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at     ON analytics_events(created_at);
