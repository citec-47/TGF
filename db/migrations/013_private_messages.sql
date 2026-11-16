CREATE TABLE IF NOT EXISTS tgf_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES tgf_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tgf_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES tgf_message_threads(id) ON DELETE CASCADE,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('user', 'administrator')),
  sender_user_id UUID REFERENCES tgf_users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_by_user_at TIMESTAMPTZ,
  read_by_admin_at TIMESTAMPTZ,
  CONSTRAINT tgf_messages_sender_valid CHECK (
    (sender_kind = 'administrator' AND length(trim(sender_name)) > 0) OR
    (sender_kind = 'user' AND sender_user_id IS NOT NULL)
  ),
  CONSTRAINT tgf_messages_body_length CHECK (length(body) <= 2000)
);

CREATE INDEX IF NOT EXISTS tgf_messages_thread_created
  ON tgf_messages (thread_id, created_at, id);

CREATE INDEX IF NOT EXISTS tgf_messages_unread_user
  ON tgf_messages (thread_id, read_by_user_at)
  WHERE sender_kind = 'administrator';

CREATE INDEX IF NOT EXISTS tgf_messages_unread_admin
  ON tgf_messages (thread_id, read_by_admin_at)
  WHERE sender_kind = 'user';

CREATE TABLE IF NOT EXISTS tgf_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES tgf_messages(id) ON DELETE CASCADE,
  cloudinary_public_id TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  cloudinary_format TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tgf_message_attachments_message
  ON tgf_message_attachments (message_id, created_at);
