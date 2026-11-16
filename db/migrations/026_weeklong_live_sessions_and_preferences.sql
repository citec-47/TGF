ALTER TABLE tgf_course_timetable_slots
  DROP CONSTRAINT IF EXISTS tgf_course_timetable_slots_weekday_check;

ALTER TABLE tgf_course_timetable_slots
  ADD CONSTRAINT tgf_course_timetable_slots_weekday_check
  CHECK (weekday BETWEEN 1 AND 7);

ALTER TABLE tgf_live_sessions
  ALTER COLUMN timetable_slot_id DROP NOT NULL;

ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS programme_id UUID REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES tgf_users(id) ON DELETE CASCADE;

UPDATE tgf_live_sessions live_session
SET programme_id = timetable.programme_id,
    teacher_id = timetable.teacher_id
FROM tgf_course_timetable_slots slot
JOIN tgf_course_timetables timetable ON timetable.id = slot.timetable_id
WHERE live_session.timetable_slot_id = slot.id
  AND (live_session.programme_id IS NULL OR live_session.teacher_id IS NULL);

ALTER TABLE tgf_live_sessions
  ALTER COLUMN programme_id SET NOT NULL,
  ALTER COLUMN teacher_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS tgf_live_sessions_active_course
  ON tgf_live_sessions (teacher_id, programme_id, started_at DESC)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS tgf_user_dashboard_preferences (
  user_id UUID PRIMARY KEY REFERENCES tgf_users(id) ON DELETE CASCADE,
  background_color TEXT NOT NULL DEFAULT '#f9f5f0',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_user_dashboard_preferences_color_valid
    CHECK (background_color ~ '^#[0-9a-fA-F]{6}$')
);
