ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS total_fee BIGINT NOT NULL DEFAULT 0;

ALTER TABLE tgf_programmes
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_programmes
  DROP CONSTRAINT IF EXISTS tgf_programmes_total_fee_nonnegative;

ALTER TABLE tgf_programmes
  ADD CONSTRAINT tgf_programmes_total_fee_nonnegative
  CHECK (total_fee >= 0);

ALTER TABLE tgf_programmes
  DROP CONSTRAINT IF EXISTS tgf_programmes_payment_instructions_length;

ALTER TABLE tgf_programmes
  ADD CONSTRAINT tgf_programmes_payment_instructions_length
  CHECK (length(payment_instructions) <= 2000);

UPDATE tgf_programmes
SET total_fee = registration_fee
WHERE total_fee < registration_fee;

CREATE TABLE IF NOT EXISTS tgf_programme_payment_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES tgf_programmes(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number BETWEEN 1 AND 24),
  label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 120),
  amount BIGINT NOT NULL CHECK (amount > 0),
  due_days_after_enrollment INTEGER NOT NULL CHECK (due_days_after_enrollment BETWEEN 0 AND 3650),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (programme_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS tgf_programme_installments_by_programme
  ON tgf_programme_payment_installments (programme_id, sequence_number);

CREATE TABLE IF NOT EXISTS tgf_programme_payment_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID REFERENCES tgf_programmes(id) ON DELETE SET NULL,
  programme_title TEXT NOT NULL,
  total_fee BIGINT NOT NULL CHECK (total_fee >= 0),
  payment_instructions TEXT NOT NULL DEFAULT '',
  installments JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(installments) = 'array'),
  changed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_programme_payment_plan_history_by_programme
  ON tgf_programme_payment_plan_history (programme_id, changed_at DESC);

INSERT INTO tgf_programme_payment_installments
  (programme_id, sequence_number, label, amount, due_days_after_enrollment)
SELECT id, 1, 'Programme payment', total_fee, 0
FROM tgf_programmes
WHERE total_fee > 0
  AND NOT EXISTS (
    SELECT 1 FROM tgf_programme_payment_installments installment
    WHERE installment.programme_id = tgf_programmes.id
  );

ALTER TABLE tgf_payment_submissions
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'activation';

ALTER TABLE tgf_payment_submissions
  DROP CONSTRAINT IF EXISTS tgf_payment_submissions_payment_type_valid;

ALTER TABLE tgf_payment_submissions
  ADD CONSTRAINT tgf_payment_submissions_payment_type_valid
  CHECK (payment_type IN ('activation', 'installment'));
