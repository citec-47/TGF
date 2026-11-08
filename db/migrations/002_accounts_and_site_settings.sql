CREATE TABLE IF NOT EXISTS tgf_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operations',
  subsidiary TEXT NOT NULL DEFAULT 'tgfvp',
  is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_users_name_not_blank CHECK (length(trim(full_name)) > 0),
  CONSTRAINT tgf_users_name_length CHECK (length(full_name) <= 120),
  CONSTRAINT tgf_users_email_length CHECK (length(email) <= 254),
  CONSTRAINT tgf_users_role_valid CHECK (
    role IN ('administrator', 'executive', 'subsidiary_manager', 'supervisor', 'operations', 'learner')
  ),
  CONSTRAINT tgf_users_subsidiary_valid CHECK (
    subsidiary IN ('central_administration', 'best_rides', 'dehivas', 'tgf_supersales', 'tgfvp')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS tgf_users_email_lower_unique ON tgf_users (lower(email));
CREATE INDEX IF NOT EXISTS tgf_users_role_status_idx ON tgf_users (role, is_frozen);

CREATE TABLE IF NOT EXISTS tgf_site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system'
);

INSERT INTO tgf_site_settings (key, value)
VALUES
  ('resumption_date', ''),
  ('resumption_label', 'Training resumes'),
  ('accent_color', '#F47D20'),
  ('flyer_image_url', '/TWO/WhatsApp%20Image%202026-10-29%20at%2021.12.52.jpeg')
ON CONFLICT (key) DO NOTHING;
