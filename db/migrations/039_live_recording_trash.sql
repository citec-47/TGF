ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS recording_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_deleted_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_purge_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tgf_live_sessions_recording_trash
  ON tgf_live_sessions (recording_deleted_at)
  WHERE recording_deleted_at IS NOT NULL;
