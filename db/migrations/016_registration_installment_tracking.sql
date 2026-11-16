ALTER TABLE tgf_programme_payment_installments
  ADD COLUMN IF NOT EXISTS payment_category TEXT NOT NULL DEFAULT 'installment';

ALTER TABLE tgf_programme_payment_installments
  DROP CONSTRAINT IF EXISTS tgf_programme_payment_installments_payment_category_valid;

ALTER TABLE tgf_programme_payment_installments
  ADD CONSTRAINT tgf_programme_payment_installments_payment_category_valid
  CHECK (payment_category IN ('registration', 'installment'));

UPDATE tgf_programme_payment_installments installment
SET payment_category = 'registration',
    label = 'Registration fee'
FROM tgf_programmes programme
WHERE installment.programme_id = programme.id
  AND installment.sequence_number = 1
  AND installment.amount = programme.registration_fee
  AND programme.registration_fee > 0
  AND lower(installment.label) IN ('activation and programme fee', 'registration fee');

ALTER TABLE tgf_payment_submissions
  ADD COLUMN IF NOT EXISTS installment_sequence_number INTEGER;

ALTER TABLE tgf_payment_submissions
  ADD COLUMN IF NOT EXISTS payment_label TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_payment_submissions
  DROP CONSTRAINT IF EXISTS tgf_payment_submissions_installment_sequence_valid;

ALTER TABLE tgf_payment_submissions
  ADD CONSTRAINT tgf_payment_submissions_installment_sequence_valid
  CHECK (installment_sequence_number IS NULL OR installment_sequence_number BETWEEN 1 AND 24);

ALTER TABLE tgf_admin_recorded_payments
  ADD COLUMN IF NOT EXISTS payment_category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE tgf_admin_recorded_payments
  ADD COLUMN IF NOT EXISTS installment_sequence_number INTEGER;

ALTER TABLE tgf_admin_recorded_payments
  ADD COLUMN IF NOT EXISTS payment_label TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_admin_recorded_payments
  DROP CONSTRAINT IF EXISTS tgf_admin_recorded_payments_payment_category_valid;

ALTER TABLE tgf_admin_recorded_payments
  ADD CONSTRAINT tgf_admin_recorded_payments_payment_category_valid
  CHECK (payment_category IN ('registration', 'installment', 'other'));

ALTER TABLE tgf_admin_recorded_payments
  DROP CONSTRAINT IF EXISTS tgf_admin_recorded_payments_installment_sequence_valid;

ALTER TABLE tgf_admin_recorded_payments
  ADD CONSTRAINT tgf_admin_recorded_payments_installment_sequence_valid
  CHECK (installment_sequence_number IS NULL OR installment_sequence_number BETWEEN 1 AND 24);
