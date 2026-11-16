CREATE TABLE IF NOT EXISTS tgf_student_module_overrides (
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  access_state TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, module_id),
  CONSTRAINT tgf_student_module_override_state_valid
    CHECK (access_state IN ('unlocked', 'blocked'))
);

CREATE TABLE IF NOT EXISTS tgf_student_live_presence (
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  live_class_id UUID NOT NULL REFERENCES tgf_live_classes(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, live_class_id),
  CONSTRAINT tgf_student_live_presence_times_valid
    CHECK (ended_at IS NULL OR ended_at >= joined_at)
);

CREATE INDEX IF NOT EXISTS tgf_student_live_presence_active
  ON tgf_student_live_presence (last_seen_at DESC, user_id)
  WHERE ended_at IS NULL;