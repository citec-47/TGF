ALTER TABLE tgf_course_submissions
  ADD COLUMN duration_seconds INTEGER;

ALTER TABLE tgf_course_submissions
  ADD CONSTRAINT tgf_course_submission_video_duration_valid
  CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 1 AND 86400);
