ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_role_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_role_valid CHECK (
    role IN (
      'administrator',
      'executive',
      'subsidiary_manager',
      'supervisor',
      'operations',
      'teacher',
      'learner'
    )
  );

CREATE TABLE IF NOT EXISTS tgf_board_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  hierarchy_group TEXT NOT NULL,
  biography TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_board_member_name_length CHECK (
    length(trim(full_name)) BETWEEN 2 AND 120
  ),
  CONSTRAINT tgf_board_member_title_length CHECK (
    length(trim(position_title)) BETWEEN 2 AND 120
  ),
  CONSTRAINT tgf_board_member_group_length CHECK (
    length(trim(hierarchy_group)) BETWEEN 2 AND 100
  ),
  CONSTRAINT tgf_board_member_biography_length CHECK (length(biography) <= 1200),
  CONSTRAINT tgf_board_member_photo_length CHECK (length(photo_url) <= 1000),
  CONSTRAINT tgf_board_member_order CHECK (sort_order BETWEEN 0 AND 9999)
);

CREATE INDEX IF NOT EXISTS tgf_board_members_public_order
  ON tgf_board_members (is_active, sort_order, lower(hierarchy_group), lower(full_name));

CREATE TABLE IF NOT EXISTS tgf_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_programme_title_length CHECK (length(trim(title)) BETWEEN 2 AND 120),
  CONSTRAINT tgf_programme_description_length CHECK (length(description) <= 2000),
  CONSTRAINT tgf_programme_order CHECK (sort_order BETWEEN 0 AND 9999)
);

CREATE UNIQUE INDEX IF NOT EXISTS tgf_programmes_title_lower_unique
  ON tgf_programmes (lower(title));

INSERT INTO tgf_programmes (title, description, sort_order, is_active)
VALUES
  ('Software Engineering', 'Build practical software development skills through structured modules and instructor-led classes.', 1, TRUE),
  ('Career Strategy & Entrepreneurship', 'Explore career planning, practical business strategy and entrepreneurship.', 2, TRUE),
  ('Digital Marketing', 'Learn practical digital marketing concepts and tools through guided modules.', 3, TRUE),
  ('Electronics Maintenance', 'Develop foundational electronics maintenance and troubleshooting skills.', 4, TRUE),
  ('Driving & Road Safety', 'Build driving and road safety knowledge with guided training.', 5, TRUE),
  ('Mechanics & Diagnostics', 'Explore automotive maintenance, mechanics and diagnostics.', 6, TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tgf_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lesson_content TEXT NOT NULL DEFAULT '',
  meeting_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 1,
  is_released BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_module_title_length CHECK (length(trim(title)) BETWEEN 2 AND 160),
  CONSTRAINT tgf_module_description_length CHECK (length(description) <= 1000),
  CONSTRAINT tgf_module_content_length CHECK (length(lesson_content) <= 30000),
  CONSTRAINT tgf_module_meeting_url_length CHECK (length(meeting_url) <= 1000),
  CONSTRAINT tgf_module_position CHECK (position BETWEEN 1 AND 9999),
  CONSTRAINT tgf_modules_programme_position_unique UNIQUE (programme_id, position)
);

CREATE INDEX IF NOT EXISTS tgf_modules_programme_order
  ON tgf_modules (programme_id, position);

CREATE TABLE IF NOT EXISTS tgf_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_enrollments_unique UNIQUE (user_id, programme_id)
);

CREATE INDEX IF NOT EXISTS tgf_enrollments_by_programme
  ON tgf_enrollments (programme_id, user_id);

CREATE TABLE IF NOT EXISTS tgf_module_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_module_completions_unique UNIQUE (user_id, module_id)
);

CREATE TABLE IF NOT EXISTS tgf_live_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE RESTRICT,
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  meeting_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_class_title_length CHECK (length(trim(title)) BETWEEN 2 AND 160),
  CONSTRAINT tgf_live_class_url_length CHECK (length(meeting_url) <= 1000)
);

CREATE INDEX IF NOT EXISTS tgf_live_classes_by_module_time
  ON tgf_live_classes (module_id, is_active, starts_at);

CREATE TABLE IF NOT EXISTS tgf_lesson_boards (
  module_id UUID PRIMARY KEY REFERENCES tgf_modules(id) ON DELETE CASCADE,
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_lesson_board_strokes_array CHECK (jsonb_typeof(strokes) = 'array')
);
