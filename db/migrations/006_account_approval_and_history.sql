ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE tgf_users
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_users
  DROP CONSTRAINT IF EXISTS tgf_users_account_status_valid;

ALTER TABLE tgf_users
  ADD CONSTRAINT tgf_users_account_status_valid
  CHECK (account_status IN ('pending', 'active', 'rejected'));

DROP INDEX IF EXISTS tgf_users_email_lower_unique;

CREATE UNIQUE INDEX IF NOT EXISTS tgf_users_email_nonrejected_unique
  ON tgf_users (lower(email))
  WHERE account_status <> 'rejected';

CREATE TABLE IF NOT EXISTS tgf_user_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  account_email TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  actor_kind TEXT NOT NULL DEFAULT 'system',
  actor_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_user_status_history_status_valid
    CHECK (status IN ('pending', 'active', 'rejected', 'frozen')),
  CONSTRAINT tgf_user_status_history_actor_valid
    CHECK (actor_kind IN ('system', 'super_admin', 'member'))
);

CREATE INDEX IF NOT EXISTS tgf_user_status_history_account_time
  ON tgf_user_status_history (user_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS tgf_user_status_history_status_time
  ON tgf_user_status_history (status, changed_at DESC);

INSERT INTO tgf_user_status_history (user_id, account_email, status, reason, actor_kind, changed_at)
SELECT u.id, u.email, CASE WHEN u.is_frozen THEN 'frozen' ELSE u.account_status END,
       '', 'system', COALESCE(u.updated_at, u.created_at)
FROM tgf_users u
WHERE NOT EXISTS (
  SELECT 1 FROM tgf_user_status_history h
  WHERE h.user_id = u.id AND h.changed_at = COALESCE(u.updated_at, u.created_at)
);