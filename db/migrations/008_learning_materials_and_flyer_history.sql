CREATE TABLE IF NOT EXISTS tgf_learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES tgf_modules(id) ON DELETE CASCADE,
  uploader_user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  cloudinary_format TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  admin_feedback TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tgf_learning_materials_by_module
  ON tgf_learning_materials (module_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS tgf_learning_materials_pending_by_date
  ON tgf_learning_materials (submitted_at)
  WHERE review_status = 'pending';

CREATE TABLE IF NOT EXISTS tgf_material_week_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES tgf_learning_materials(id) ON DELETE CASCADE,
  module_week_id UUID NOT NULL REFERENCES tgf_module_weeks(id) ON DELETE CASCADE,
  section_title TEXT NOT NULL,
  page_start INTEGER CHECK (page_start IS NULL OR page_start > 0),
  page_end INTEGER CHECK (page_end IS NULL OR page_end >= page_start),
  learning_objectives TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('reading', 'notes', 'worksheet', 'reference', 'assessment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, module_week_id),
  CHECK (
    (page_start IS NULL AND page_end IS NULL) OR
    (page_start IS NOT NULL AND page_end IS NOT NULL AND page_end >= page_start)
  )
);

CREATE INDEX IF NOT EXISTS tgf_material_assignments_by_week
  ON tgf_material_week_assignments (module_week_id);

CREATE TABLE IF NOT EXISTS tgf_flyer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  flyer_date_text TEXT NOT NULL DEFAULT '',
  changed_by UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_flyer_history_by_date
  ON tgf_flyer_history (saved_at DESC);
