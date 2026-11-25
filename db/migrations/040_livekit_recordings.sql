ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS recording_provider TEXT NOT NULL DEFAULT 'cloudinary',
  ADD COLUMN IF NOT EXISTS recording_storage_key TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_live_sessions
  DROP CONSTRAINT IF EXISTS tgf_live_sessions_recording_provider_check;

ALTER TABLE tgf_live_sessions
  ADD CONSTRAINT tgf_live_sessions_recording_provider_check
  CHECK (recording_provider IN ('cloudinary', 'livekit'));

CREATE UNIQUE INDEX IF NOT EXISTS tgf_live_sessions_egress_id_unique
  ON tgf_live_sessions (egress_id)
  WHERE egress_id <> '';
