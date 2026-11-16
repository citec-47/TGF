CREATE TABLE IF NOT EXISTS tgf_public_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('career', 'community', 'contact')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cv_public_id TEXT,
  cv_original_filename TEXT,
  cv_content_type TEXT,
  cv_format TEXT,
  cv_size BIGINT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_public_submission_name_length CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
  CONSTRAINT tgf_public_submission_email_length CHECK (length(trim(email)) BETWEEN 3 AND 254),
  CONSTRAINT tgf_public_submission_phone_length CHECK (length(phone) <= 30),
  CONSTRAINT tgf_public_submission_location_length CHECK (length(location) <= 100),
  CONSTRAINT tgf_public_submission_subject_length CHECK (length(subject) <= 120),
  CONSTRAINT tgf_public_submission_message_length CHECK (length(message) <= 3000),
  CONSTRAINT tgf_public_submission_kind_fields CHECK (
    (kind = 'career' AND length(trim(subject)) BETWEEN 2 AND 120
      AND cv_public_id IS NOT NULL AND cv_original_filename IS NOT NULL
      AND cv_content_type IS NOT NULL AND cv_format IS NOT NULL
      AND cv_size IS NOT NULL AND cv_size > 0)
    OR (kind = 'community' AND cv_public_id IS NULL AND cv_original_filename IS NULL
      AND cv_content_type IS NULL AND cv_format IS NULL AND cv_size IS NULL)
    OR (kind = 'contact' AND length(trim(subject)) BETWEEN 2 AND 120
      AND length(trim(message)) BETWEEN 10 AND 3000 AND newsletter_opt_in = FALSE
      AND cv_public_id IS NULL AND cv_original_filename IS NULL
      AND cv_content_type IS NULL AND cv_format IS NULL AND cv_size IS NULL)
  ),
  CONSTRAINT tgf_public_submission_newsletter_kind CHECK (
    kind = 'community' OR newsletter_opt_in = FALSE
  )
);

CREATE INDEX IF NOT EXISTS tgf_public_submissions_inbox
  ON tgf_public_submissions (created_at DESC, id);

CREATE INDEX IF NOT EXISTS tgf_public_submissions_newsletter
  ON tgf_public_submissions (created_at DESC, email)
  WHERE kind = 'community' AND newsletter_opt_in = TRUE;
