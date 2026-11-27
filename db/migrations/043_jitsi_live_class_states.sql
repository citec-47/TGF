ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS class_status TEXT NOT NULL DEFAULT 'scheduled';

UPDATE tgf_live_sessions
SET class_status = CASE
  WHEN ended_at IS NOT NULL THEN 'ended'
  WHEN started_at IS NOT NULL THEN 'live'
  ELSE 'scheduled'
END
WHERE class_status NOT IN ('scheduled', 'live', 'ended', 'cancelled')
   OR (class_status = 'scheduled' AND started_at IS NOT NULL)
   OR (class_status = 'live' AND ended_at IS NOT NULL);

ALTER TABLE tgf_live_sessions
  DROP CONSTRAINT IF EXISTS tgf_live_sessions_class_status_check;

ALTER TABLE tgf_live_sessions
  ADD CONSTRAINT tgf_live_sessions_class_status_check
  CHECK (class_status IN ('scheduled', 'live', 'ended', 'cancelled'));

CREATE INDEX IF NOT EXISTS tgf_live_sessions_by_class_status
  ON tgf_live_sessions (teacher_id, class_status, created_at DESC);
