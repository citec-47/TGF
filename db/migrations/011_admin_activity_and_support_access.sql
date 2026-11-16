CREATE TABLE IF NOT EXISTS tgf_user_support_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  target_name TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_user_support_access_audit_actor
  ON tgf_user_support_access_audit (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tgf_user_support_access_audit_target
  ON tgf_user_support_access_audit (target_user_id, created_at DESC);
