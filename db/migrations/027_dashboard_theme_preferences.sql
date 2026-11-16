ALTER TABLE tgf_user_dashboard_preferences
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light';

ALTER TABLE tgf_user_dashboard_preferences
  DROP COLUMN IF EXISTS background_color;

ALTER TABLE tgf_user_dashboard_preferences
  ADD CONSTRAINT tgf_user_dashboard_preferences_theme_valid
  CHECK (theme IN ('light', 'dark'));
