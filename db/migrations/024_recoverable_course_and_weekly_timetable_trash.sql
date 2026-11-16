ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_was_active BOOLEAN;

CREATE INDEX IF NOT EXISTS tgf_programmes_deleted_at
  ON tgf_programmes (deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE tgf_course_timetables
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tgf_course_timetables_deleted_at
  ON tgf_course_timetables (deleted_at)
  WHERE deleted_at IS NOT NULL;
