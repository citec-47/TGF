CREATE TABLE IF NOT EXISTS tgf_live_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE RESTRICT,
  course_title TEXT NOT NULL,
  class_date DATE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  upload_status TEXT NOT NULL DEFAULT 'recording'
    CHECK (upload_status IN ('recording', 'uploading', 'ready', 'failed')),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_recordings_error_length CHECK (length(last_error) <= 1000)
);

CREATE INDEX IF NOT EXISTS tgf_live_recordings_course_date
  ON tgf_live_recordings (programme_id, class_date DESC)
  WHERE upload_status = 'ready';

CREATE TABLE IF NOT EXISTS tgf_live_recording_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES tgf_live_recordings(id) ON DELETE CASCADE,
  part_number SMALLINT NOT NULL CHECK (part_number BETWEEN 1 AND 100),
  part_title TEXT NOT NULL,
  cloudinary_public_id TEXT NOT NULL DEFAULT '',
  secure_url TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  file_size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  upload_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (upload_status IN ('pending', 'uploading', 'ready', 'failed')),
  last_error TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_recording_parts_unique UNIQUE (recording_id, part_number),
  CONSTRAINT tgf_live_recording_parts_error_length CHECK (length(last_error) <= 1000)
);

CREATE TABLE IF NOT EXISTS tgf_live_recording_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES tgf_live_recordings(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_recording_email_log_unique UNIQUE (recording_id, recipient_email),
  CONSTRAINT tgf_live_recording_email_log_error_length CHECK (length(error_message) <= 1000)
);
ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_profile_photo_url_length;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_profile_photo_url_length
  CHECK (length(profile_photo_url) <= 1000);
