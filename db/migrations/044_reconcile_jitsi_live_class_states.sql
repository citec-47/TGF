UPDATE tgf_live_sessions
SET class_status = CASE
  WHEN ended_at IS NOT NULL THEN 'ended'
  WHEN started_at IS NOT NULL THEN 'live'
  ELSE 'scheduled'
END
WHERE class_status <> 'cancelled'
  AND class_status IS DISTINCT FROM CASE
    WHEN ended_at IS NOT NULL THEN 'ended'
    WHEN started_at IS NOT NULL THEN 'live'
    ELSE 'scheduled'
  END;

ALTER TABLE tgf_live_sessions
  DROP CONSTRAINT IF EXISTS tgf_live_sessions_class_state_consistency_check;

ALTER TABLE tgf_live_sessions
  ADD CONSTRAINT tgf_live_sessions_class_state_consistency_check
  CHECK (
    (class_status = 'scheduled' AND started_at IS NULL AND ended_at IS NULL)
    OR (class_status = 'live' AND started_at IS NOT NULL AND ended_at IS NULL)
    OR (class_status = 'ended' AND ended_at IS NOT NULL)
    OR class_status = 'cancelled'
  );
