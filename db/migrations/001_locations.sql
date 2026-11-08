CREATE TABLE IF NOT EXISTS tgf_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_locations_city_not_blank CHECK (length(trim(city)) > 0),
  CONSTRAINT tgf_locations_city_length CHECK (length(city) <= 100),
  CONSTRAINT tgf_locations_region_length CHECK (length(region) <= 100),
  CONSTRAINT tgf_locations_address_length CHECK (length(address) <= 300),
  CONSTRAINT tgf_locations_description_length CHECK (length(description) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS tgf_locations_city_lower_unique
  ON tgf_locations (lower(city));

CREATE INDEX IF NOT EXISTS tgf_locations_public_order
  ON tgf_locations (is_active, sort_order, lower(city));

INSERT INTO tgf_locations (city, region, address, sort_order)
VALUES
  ('Bamenda', 'Northwest Region', '', 1),
  ('Yaounde', 'Centre Region', 'Nouvelle Route, Nkolbison', 2),
  ('Douala', 'Littoral Region', 'Ancient No. 1, Akwa', 3),
  ('Buea', 'Southwest Region', '', 4)
ON CONFLICT DO NOTHING;
