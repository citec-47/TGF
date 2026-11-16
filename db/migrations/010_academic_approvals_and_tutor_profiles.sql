ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'online';

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES tgf_locations(id) ON DELETE SET NULL;

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS venue TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE tgf_live_classes
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL;

UPDATE tgf_live_classes
SET approval_status = 'approved';

ALTER TABLE tgf_live_classes
  DROP CONSTRAINT IF EXISTS tgf_live_classes_approval_status_valid;

ALTER TABLE tgf_live_classes
  ADD CONSTRAINT tgf_live_classes_approval_status_valid
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE tgf_live_classes
  DROP CONSTRAINT IF EXISTS tgf_live_classes_delivery_mode_valid;

ALTER TABLE tgf_live_classes
  ADD CONSTRAINT tgf_live_classes_delivery_mode_valid
  CHECK (delivery_mode IN ('online', 'location', 'venue'));

ALTER TABLE tgf_live_classes
  DROP CONSTRAINT IF EXISTS tgf_live_classes_delivery_details_valid;

ALTER TABLE tgf_live_classes
  ADD CONSTRAINT tgf_live_classes_delivery_details_valid
  CHECK (
    (delivery_mode = 'online' AND length(trim(meeting_url)) > 0 AND location_id IS NULL AND venue = '') OR
    (delivery_mode = 'location' AND location_id IS NOT NULL AND venue = '') OR
    (delivery_mode = 'venue' AND location_id IS NULL AND length(trim(venue)) BETWEEN 2 AND 250)
  );

CREATE INDEX IF NOT EXISTS tgf_live_classes_pending_approval
  ON tgf_live_classes (starts_at, module_id)
  WHERE approval_status = 'pending' AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS tgf_live_classes_approved_module_time
  ON tgf_live_classes (module_id, starts_at)
  WHERE approval_status = 'approved' AND is_active = TRUE;

CREATE TABLE IF NOT EXISTS tgf_live_class_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID REFERENCES tgf_live_classes(id) ON DELETE SET NULL,
  class_title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'updated', 'deleted', 'cancelled')),
  reason TEXT NOT NULL DEFAULT '',
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_live_class_review_history_by_class
  ON tgf_live_class_review_history (live_class_id, changed_at DESC);

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_title TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_biography TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_qualifications TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_profile_visible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_profile_reviewed_at TIMESTAMPTZ;

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS teacher_profile_reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL;

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_teacher_profile_lengths_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_teacher_profile_lengths_valid
  CHECK (
    length(teacher_title) <= 120 AND
    length(teacher_biography) <= 2000 AND
    length(teacher_qualifications) <= 1200
  );

CREATE INDEX IF NOT EXISTS tgf_users_visible_teacher_profiles
  ON tgf_users (id)
  WHERE role = 'teacher' AND account_status = 'active' AND is_frozen = FALSE
    AND teacher_profile_visible = TRUE;

CREATE TABLE IF NOT EXISTS tgf_teacher_profile_visibility_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  teacher_name TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL,
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_teacher_profile_visibility_history_by_teacher
  ON tgf_teacher_profile_visibility_history (teacher_user_id, changed_at DESC);
