CREATE TABLE IF NOT EXISTS tgf_live_class_media_participants (
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  camera_on BOOLEAN NOT NULL DEFAULT FALSE,
  microphone_on BOOLEAN NOT NULL DEFAULT FALSE,
  screen_on BOOLEAN NOT NULL DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, participant_id)
);

CREATE INDEX IF NOT EXISTS tgf_live_class_media_presence
  ON tgf_live_class_media_participants (session_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS tgf_live_class_media_signals (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  from_participant_id UUID NOT NULL,
  to_participant_id UUID NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'candidate')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_live_class_media_signals_recipient
  ON tgf_live_class_media_signals (session_id, to_participant_id, id);

CREATE INDEX IF NOT EXISTS tgf_live_class_media_signals_expiration
  ON tgf_live_class_media_signals (created_at);
