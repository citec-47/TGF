ALTER TABLE tgf_live_session_attendance
  ADD COLUMN IF NOT EXISTS participant_role TEXT NOT NULL DEFAULT 'learner',
  ADD COLUMN IF NOT EXISTS microphone_allowed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tgf_live_session_attendance
  DROP CONSTRAINT IF EXISTS tgf_live_session_attendance_participant_role_check;

ALTER TABLE tgf_live_session_attendance
  ADD CONSTRAINT tgf_live_session_attendance_participant_role_check
  CHECK (participant_role IN ('learner', 'teacher', 'administrator'));
