CREATE TABLE IF NOT EXISTS tgf_corporate_site_content (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  content JSONB NOT NULL,
  updated_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
