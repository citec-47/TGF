CREATE TABLE IF NOT EXISTS tgf_course_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'superseded')),
  timezone TEXT NOT NULL DEFAULT 'Africa/Douala',
  rejection_reason TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  CONSTRAINT tgf_course_timetables_timezone_length CHECK (length(timezone) BETWEEN 1 AND 80),
  CONSTRAINT tgf_course_timetables_reason_length CHECK (length(rejection_reason) <= 1000)
);

CREATE INDEX IF NOT EXISTS tgf_course_timetables_pending
  ON tgf_course_timetables (submitted_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tgf_course_timetables_approved_course
  ON tgf_course_timetables (programme_id, teacher_id)
  WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS tgf_course_timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_id UUID NOT NULL REFERENCES tgf_course_timetables(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  CONSTRAINT tgf_course_timetable_slot_order CHECK (ends_at > starts_at),
  CONSTRAINT tgf_course_timetable_slot_unique UNIQUE (timetable_id, weekday, starts_at, ends_at)
);

CREATE INDEX IF NOT EXISTS tgf_course_timetable_slots_by_timetable
  ON tgf_course_timetable_slots (timetable_id, weekday, starts_at);

CREATE TABLE IF NOT EXISTS tgf_peer_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_kind TEXT NOT NULL CHECK (conversation_kind IN ('tutor', 'classmate')),
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  user_one_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  user_two_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  CONSTRAINT tgf_peer_conversation_members_valid CHECK (user_one_id::text < user_two_id::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS tgf_peer_conversations_unique
  ON tgf_peer_conversations (conversation_kind, programme_id, user_one_id, user_two_id);

CREATE INDEX IF NOT EXISTS tgf_peer_conversations_user_activity
  ON tgf_peer_conversations (user_one_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS tgf_peer_conversations_other_activity
  ON tgf_peer_conversations (user_two_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS tgf_peer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES tgf_peer_conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_peer_messages_body_length CHECK (length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS tgf_peer_messages_conversation_created
  ON tgf_peer_messages (conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS tgf_peer_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES tgf_peer_messages(id) ON DELETE CASCADE,
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_format TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_peer_message_attachments_message
  ON tgf_peer_message_attachments (message_id, created_at);

CREATE TABLE IF NOT EXISTS tgf_peer_conversation_reads (
  conversation_id UUID NOT NULL REFERENCES tgf_peer_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS tgf_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timetable_slot_id UUID NOT NULL REFERENCES tgf_course_timetable_slots(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  room_name TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recording_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (recording_status IN ('pending', 'recording', 'uploading', 'ready', 'failed')),
  egress_id TEXT NOT NULL DEFAULT '',
  recording_url TEXT NOT NULL DEFAULT '',
  cloudinary_public_id TEXT NOT NULL DEFAULT '',
  recording_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_sessions_recording_error_length CHECK (length(recording_error) <= 1000),
  CONSTRAINT tgf_live_sessions_time_order CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CONSTRAINT tgf_live_sessions_slot_date_unique UNIQUE (timetable_slot_id, class_date)
);

CREATE INDEX IF NOT EXISTS tgf_live_sessions_recordings
  ON tgf_live_sessions (class_date DESC, recording_status);

CREATE TABLE IF NOT EXISTS tgf_live_session_attendance (
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  first_joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_joined_at TIMESTAMPTZ,
  last_left_at TIMESTAMPTZ,
  total_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS tgf_live_session_attendance_by_user
  ON tgf_live_session_attendance (user_id, session_id);

CREATE TABLE IF NOT EXISTS tgf_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tgf_users(id) ON DELETE CASCADE,
  target_role TEXT CHECK (target_role IN ('administrator')),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT tgf_notifications_recipient_valid CHECK (
    (user_id IS NOT NULL AND target_role IS NULL) OR
    (user_id IS NULL AND target_role IS NOT NULL)
  ),
  CONSTRAINT tgf_notifications_title_length CHECK (length(title) BETWEEN 1 AND 160),
  CONSTRAINT tgf_notifications_body_length CHECK (length(body) <= 1000),
  CONSTRAINT tgf_notifications_data_object CHECK (jsonb_typeof(data) = 'object')
);

CREATE INDEX IF NOT EXISTS tgf_notifications_user_unread
  ON tgf_notifications (user_id, created_at DESC)
  WHERE user_id IS NOT NULL AND read_at IS NULL;

CREATE INDEX IF NOT EXISTS tgf_notifications_admin_unread
  ON tgf_notifications (created_at DESC)
  WHERE target_role = 'administrator' AND read_at IS NULL;
