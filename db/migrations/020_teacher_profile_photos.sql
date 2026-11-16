ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_profile_photo_url TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_teacher_profile_photo_url_length;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_teacher_profile_photo_url_length
  CHECK (length(teacher_profile_photo_url) <= 1000);
