ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS recording_hidden_from_admin_at TIMESTAMPTZ;
