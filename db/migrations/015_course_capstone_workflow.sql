CREATE TABLE IF NOT EXISTS tgf_programme_teachers (
  programme_id UUID PRIMARY KEY REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_programme_teachers_by_teacher
  ON tgf_programme_teachers (teacher_id, programme_id);

ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS curriculum_module_count SMALLINT;

ALTER TABLE tgf_programmes
  DROP CONSTRAINT IF EXISTS tgf_programmes_curriculum_module_count_valid;

ALTER TABLE tgf_programmes
  ADD CONSTRAINT tgf_programmes_curriculum_module_count_valid
  CHECK (curriculum_module_count IS NULL OR curriculum_module_count BETWEEN 1 AND 8);

ALTER TABLE tgf_modules
  ADD COLUMN IF NOT EXISTS capstone_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tgf_module_weeks
  ADD COLUMN IF NOT EXISTS lesson_content TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_module_weeks
  DROP CONSTRAINT IF EXISTS tgf_module_weeks_lesson_content_length;

ALTER TABLE tgf_module_weeks
  ADD CONSTRAINT tgf_module_weeks_lesson_content_length
  CHECK (length(lesson_content) <= 12000);

CREATE TABLE IF NOT EXISTS tgf_course_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  cloudinary_format TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'generating', 'drafted', 'approved', 'rejected')),
  module_count SMALLINT CHECK (module_count IS NULL OR module_count BETWEEN 1 AND 8),
  curriculum_draft JSONB,
  generation_error TEXT NOT NULL DEFAULT '',
  admin_feedback TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  CONSTRAINT tgf_course_submission_title_length CHECK (length(trim(title)) BETWEEN 2 AND 120),
  CONSTRAINT tgf_course_submission_filename_length CHECK (length(original_filename) BETWEEN 1 AND 200),
  CONSTRAINT tgf_course_submission_generation_state CHECK (
    (review_status IN ('drafted', 'approved') AND module_count IS NOT NULL AND curriculum_draft IS NOT NULL) OR
    (review_status IN ('pending', 'generating', 'rejected'))
  )
);

CREATE INDEX IF NOT EXISTS tgf_course_submissions_review_queue
  ON tgf_course_submissions (review_status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS tgf_course_submissions_by_programme
  ON tgf_course_submissions (programme_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS tgf_module_capstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL UNIQUE REFERENCES tgf_modules(id) ON DELETE CASCADE,
  source_submission_id UUID REFERENCES tgf_course_submissions(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_module_capstone_prompt_length CHECK (length(trim(prompt)) BETWEEN 20 AND 5000)
);

CREATE TABLE IF NOT EXISTS tgf_capstone_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  submission_number SMALLINT NOT NULL CHECK (submission_number BETWEEN 1 AND 100),
  response_text TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (review_status IN ('submitted', 'changes_requested', 'approved', 'superseded')),
  teacher_feedback TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  CONSTRAINT tgf_capstone_response_length CHECK (length(response_text) <= 12000),
  CONSTRAINT tgf_capstone_feedback_length CHECK (length(teacher_feedback) <= 2000),
  CONSTRAINT tgf_capstone_submission_number_unique UNIQUE (module_id, user_id, submission_number)
);

CREATE INDEX IF NOT EXISTS tgf_capstone_submissions_by_module_status
  ON tgf_capstone_submissions (module_id, review_status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS tgf_capstone_submissions_by_learner
  ON tgf_capstone_submissions (user_id, module_id, submission_number DESC);

CREATE TABLE IF NOT EXISTS tgf_capstone_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES tgf_capstone_submissions(id) ON DELETE CASCADE,
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_format TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_capstone_attachments_by_submission
  ON tgf_capstone_attachments (submission_id);

ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS curriculum_submission_id UUID
    REFERENCES tgf_course_submissions(id) ON DELETE SET NULL;
