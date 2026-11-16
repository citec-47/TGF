ALTER TABLE tgf_learning_materials
  ADD COLUMN programme_id UUID;

UPDATE tgf_learning_materials material
SET programme_id = module.programme_id
FROM tgf_modules module
WHERE module.id = material.module_id
  AND material.programme_id IS NULL;

ALTER TABLE tgf_learning_materials
  ALTER COLUMN module_id DROP NOT NULL,
  ALTER COLUMN programme_id SET NOT NULL,
  ADD CONSTRAINT tgf_learning_materials_programme_id_fkey
    FOREIGN KEY (programme_id) REFERENCES tgf_programmes(id) ON DELETE CASCADE;

CREATE INDEX tgf_learning_materials_programme_review_idx
  ON tgf_learning_materials (programme_id, review_status, submitted_at DESC);
