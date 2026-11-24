ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS recording_format TEXT NOT NULL DEFAULT 'mp4';

ALTER TABLE tgf_live_sessions
  DROP CONSTRAINT IF EXISTS tgf_live_sessions_recording_format_check;

ALTER TABLE tgf_live_sessions
  ADD CONSTRAINT tgf_live_sessions_recording_format_check
  CHECK (recording_format IN ('mp4', 'webm'));
