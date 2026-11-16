ALTER TABLE tgf_learning_materials
  ADD COLUMN ai_week_plan JSONB,
  ADD COLUMN ai_plan_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (ai_plan_status IN ('pending', 'generating', 'drafted', 'failed')),
  ADD COLUMN ai_generation_error TEXT NOT NULL DEFAULT '';

ALTER TABLE tgf_learning_materials
  ADD CONSTRAINT tgf_learning_materials_ai_week_plan_object
    CHECK (ai_week_plan IS NULL OR jsonb_typeof(ai_week_plan) = 'object');

ALTER TABLE tgf_material_week_assignments
  ADD COLUMN section_description TEXT NOT NULL DEFAULT '';
