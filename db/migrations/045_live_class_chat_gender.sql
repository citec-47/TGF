ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'unspecified';

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_gender_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_gender_valid
  CHECK (gender IN ('male', 'female', 'unspecified'));
