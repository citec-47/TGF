ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verification_failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_email_verification_attempts_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_email_verification_attempts_valid
  CHECK (email_verification_failed_attempts BETWEEN 0 AND 5);

UPDATE tgf_users
SET email_verified_at = COALESCE(updated_at, created_at, NOW())
WHERE role = 'learner'
  AND account_status = 'active'
  AND email_verified_at IS NULL;
