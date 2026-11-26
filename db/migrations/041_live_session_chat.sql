CREATE TABLE IF NOT EXISTS tgf_live_session_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES tgf_live_sessions(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES tgf_users(id) ON DELETE CASCADE,
  client_message_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tgf_live_session_chat_body_valid
    CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  CONSTRAINT tgf_live_session_chat_sender_message_unique
    UNIQUE (session_id, sender_user_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS tgf_live_session_chat_history
  ON tgf_live_session_chat_messages (session_id, created_at, id);
