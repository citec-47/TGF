ALTER TABLE tgf_learning_materials
  ADD COLUMN ai_module_count SMALLINT
    CHECK (ai_module_count IS NULL OR ai_module_count BETWEEN 1 AND 8),
  ADD COLUMN ai_curriculum_draft JSONB;

ALTER TABLE tgf_learning_materials
  ADD CONSTRAINT tgf_learning_materials_ai_curriculum_object
    CHECK (ai_curriculum_draft IS NULL OR jsonb_typeof(ai_curriculum_draft) = 'object');
