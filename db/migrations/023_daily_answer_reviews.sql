CREATE TABLE IF NOT EXISTS tgf_daily_answer_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 4),
  day_number SMALLINT NOT NULL CHECK (day_number BETWEEN 1 AND 5),
  submission_number SMALLINT NOT NULL CHECK (submission_number BETWEEN 1 AND 100),
  response_text TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (review_status IN ('submitted', 'changes_requested', 'approved', 'superseded')),
  teacher_feedback TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  CONSTRAINT tgf_daily_answer_response_length CHECK (length(trim(response_text)) BETWEEN 10 AND 12000),
  CONSTRAINT tgf_daily_answer_feedback_length CHECK (length(teacher_feedback) <= 2000),
  CONSTRAINT tgf_daily_answer_attempt_unique
    UNIQUE (module_id, user_id, week_number, day_number, submission_number)
);

CREATE INDEX IF NOT EXISTS tgf_daily_answer_reviews_by_module
  ON tgf_daily_answer_submissions (module_id, review_status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS tgf_daily_answer_reviews_by_learner
  ON tgf_daily_answer_submissions
    (user_id, module_id, week_number, day_number, submission_number DESC);
