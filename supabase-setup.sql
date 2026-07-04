-- ══════════════════════════════════════════════════════════
-- Run this ONCE in Supabase → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════

-- Memories: things the assistant remembers about you
CREATE TABLE IF NOT EXISTS memories (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts: people you can message via the assistant
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  label TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders: scheduled reminders
CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks: to-do items
CREATE TABLE IF NOT EXISTS tasks (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history: last N messages for context
CREATE TABLE IF NOT EXISTS chat_history (
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sent messages log: track messages sent on your behalf
CREATE TABLE IF NOT EXISTS sent_messages (
  id BIGSERIAL PRIMARY KEY,
  recipient_name TEXT,
  recipient_phone TEXT,
  message TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Call logs: track phone calls made on your behalf
CREATE TABLE IF NOT EXISTS call_logs (
  id BIGSERIAL PRIMARY KEY,
  call_sid TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  message TEXT,
  call_type TEXT DEFAULT 'simple',
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER DEFAULT 0,
  recipient_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_at) WHERE done = FALSE;
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
