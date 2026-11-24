CREATE TABLE IF NOT EXISTS tgf_live_recording_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES tgf_live_recordings(id) ON DELETE CASCADE,
  chunk_number INTEGER NOT NULL CHECK (chunk_number BETWEEN 1 AND 1000000),
  part_number SMALLINT NOT NULL CHECK (part_number BETWEEN 1 AND 100),
  elapsed_seconds INTEGER NOT NULL CHECK (elapsed_seconds >= 0),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_recording_chunks_unique UNIQUE (recording_id, chunk_number)
);

CREATE INDEX IF NOT EXISTS tgf_live_recording_chunks_part_order
  ON tgf_live_recording_chunks (recording_id, part_number, chunk_number);
