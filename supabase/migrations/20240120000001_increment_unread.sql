CREATE OR REPLACE FUNCTION increment_unread(chat_id UUID)
RETURNS void AS $$
  UPDATE chats SET unread_count = unread_count + 1 WHERE id = chat_id;
$$ LANGUAGE sql;
