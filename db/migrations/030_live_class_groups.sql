CREATE TABLE IF NOT EXISTS tgf_live_class_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_class_groups_name_length CHECK (length(trim(name)) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS tgf_live_class_groups_teacher_programme_name
  ON tgf_live_class_groups (teacher_id, programme_id, lower(name));

CREATE TABLE IF NOT EXISTS tgf_live_class_group_members (
  group_id UUID NOT NULL REFERENCES tgf_live_class_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS tgf_live_class_group_members_by_user
  ON tgf_live_class_group_members (user_id, group_id);

ALTER TABLE tgf_live_sessions
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES tgf_live_class_groups(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS tgf_live_session_invites (
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS tgf_live_session_invites_by_user
  ON tgf_live_session_invites (user_id, session_id);

INSERT INTO tgf_live_session_invites (session_id, user_id)
SELECT session.id, notification.user_id
FROM tgf_live_sessions session
JOIN tgf_notifications notification
  ON notification.notification_type = 'live-class-invitation'
 AND notification.data->>'liveSessionId' = session.id::text
WHERE session.timetable_slot_id IS NULL
ON CONFLICT DO NOTHING;
