CREATE TABLE IF NOT EXISTS tgf_programme_payment_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID REFERENCES tgf_programmes(id) ON DELETE SET NULL,
  programme_title TEXT NOT NULL,
  total_fee BIGINT NOT NULL CHECK (total_fee >= 0),
  payment_instructions TEXT NOT NULL DEFAULT '',
  installments JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(installments) = 'array'),
  changed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_programme_payment_plan_history_by_programme
  ON tgf_programme_payment_plan_history (programme_id, changed_at DESC);
