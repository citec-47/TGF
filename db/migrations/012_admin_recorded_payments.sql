CREATE TABLE IF NOT EXISTS tgf_admin_recorded_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES tgf_enrollments(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'other')),
  reference TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_admin_recorded_payments_by_enrollment
  ON tgf_admin_recorded_payments (enrollment_id, recorded_at DESC);
