ALTER TABLE tgf_enrollments
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE tgf_enrollments
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE tgf_enrollments
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

UPDATE tgf_enrollments
SET approved_at = enrolled_at
WHERE approval_status = 'approved' AND approved_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tgf_enrollments_approval_status_valid'
  ) THEN
    ALTER TABLE tgf_enrollments
      ADD CONSTRAINT tgf_enrollments_approval_status_valid
      CHECK (approval_status IN ('pending', 'approved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tgf_enrollments_pending_by_date
  ON tgf_enrollments (enrolled_at, user_id, programme_id)
  WHERE approval_status = 'pending';