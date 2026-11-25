ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_whatsapp_number_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_whatsapp_number_valid
  CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_email_verification_attempts_valid,
  DROP COLUMN IF EXISTS email_verified_at,
  DROP COLUMN IF EXISTS email_verification_code_hash,
  DROP COLUMN IF EXISTS email_verification_expires_at,
  DROP COLUMN IF EXISTS email_verification_failed_attempts;
