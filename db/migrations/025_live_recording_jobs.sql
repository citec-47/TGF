ALTER TABLE tgf_live_sessions
  DROP CONSTRAINT IF EXISTS tgf_live_sessions_recording_status_check;

ALTER TABLE tgf_live_sessions
  ADD CONSTRAINT tgf_live_sessions_recording_status_check
  CHECK (recording_status IN (
    'pending', 'recording', 'processing', 'uploading',
    'uploaded', 'distributed', 'ready', 'failed'
  ));

CREATE TABLE IF NOT EXISTS tgf_live_recording_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_recording_jobs_error_length CHECK (length(last_error) <= 1000)
);

CREATE INDEX IF NOT EXISTS tgf_live_recording_jobs_ready
  ON tgf_live_recording_jobs (available_at, created_at)
  WHERE status = 'queued';

CREATE TABLE IF NOT EXISTS tgf_live_recording_distributions (
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL,
  user_id UUID REFERENCES tgf_users(id) ON DELETE CASCADE,
  target_role TEXT CHECK (target_role IN ('administrator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, recipient_key),
  CONSTRAINT tgf_live_recording_distributions_recipient_valid CHECK (
    (user_id IS NOT NULL AND target_role IS NULL) OR
    (user_id IS NULL AND target_role IS NOT NULL)
  )
);
