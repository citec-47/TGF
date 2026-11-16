ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS registration_fee BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tgf_programmes
  DROP CONSTRAINT IF EXISTS tgf_programmes_registration_fee_nonnegative;

ALTER TABLE tgf_programmes
  ADD CONSTRAINT tgf_programmes_registration_fee_nonnegative
  CHECK (registration_fee >= 0);

ALTER TABLE tgf_enrollments
  ADD COLUMN IF NOT EXISTS registration_fee BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tgf_enrollments
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_enrollments
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE tgf_enrollments
  DROP CONSTRAINT IF EXISTS tgf_enrollments_approval_status_valid;

ALTER TABLE tgf_enrollments
  ADD CONSTRAINT tgf_enrollments_approval_status_valid
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE TABLE IF NOT EXISTS tgf_enrollment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES tgf_enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_enrollment_status_history_by_enrollment
  ON tgf_enrollment_status_history (enrollment_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS tgf_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES tgf_enrollments(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF' CHECK (currency = 'XAF'),
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  cloudinary_resource_type TEXT NOT NULL DEFAULT 'raw' CHECK (cloudinary_resource_type = 'raw'),
  cloudinary_delivery_type TEXT NOT NULL DEFAULT 'authenticated'
    CHECK (cloudinary_delivery_type = 'authenticated'),
  cloudinary_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tgf_payment_submissions_by_enrollment
  ON tgf_payment_submissions (enrollment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS tgf_payment_submissions_pending_by_date
  ON tgf_payment_submissions (submitted_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS tgf_payment_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_submission_id UUID NOT NULL
    REFERENCES tgf_payment_submissions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_payment_review_history_by_submission
  ON tgf_payment_review_history (payment_submission_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS tgf_module_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  learning_objectives TEXT NOT NULL DEFAULT '',
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_module_weeks_module_week_unique UNIQUE (module_id, week_number)
);

CREATE INDEX IF NOT EXISTS tgf_module_weeks_by_module
  ON tgf_module_weeks (module_id, week_number);

INSERT INTO tgf_module_weeks (module_id, week_number, title)
SELECT m.id, weeks.week_number, 'Week ' || weeks.week_number
FROM tgf_modules m
CROSS JOIN generate_series(1, 4) AS weeks(week_number)
ON CONFLICT (module_id, week_number) DO NOTHING;
