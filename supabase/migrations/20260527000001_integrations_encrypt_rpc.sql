-- n004 Block 5: RPCs для encrypt/decrypt access_token / refresh_token.
--
-- Используются из lib/integrations/_encryption.ts через supabase.rpc().
-- Master key передаётся как параметр (читается из env в Node — не хранится в БД).

-- pgp_sym_encrypt возвращает bytea — для удобства transport в supabase-js
-- мы возвращаем encode(...,'hex') string. Decoder в TS-side работает с обоими.
CREATE OR REPLACE FUNCTION integrations_encrypt(p_plaintext text, p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT encode(pgp_sym_encrypt(p_plaintext, p_key), 'hex');
$$;

-- Принимает hex-string (без префикса '\x' или с ним — обрезаем).
CREATE OR REPLACE FUNCTION integrations_decrypt(p_ciphertext_hex text, p_key text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pgp_sym_decrypt(
    decode(replace(p_ciphertext_hex, E'\\x', ''), 'hex'),
    p_key
  );
$$;

-- Доступ только service_role (bypassed RLS); обычный anon не должен звать.
REVOKE ALL ON FUNCTION integrations_encrypt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION integrations_encrypt(text, text) TO service_role;

REVOKE ALL ON FUNCTION integrations_decrypt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION integrations_decrypt(text, text) TO service_role;

-- Verify (manual):
--   SELECT integrations_encrypt('hello', 'mysecretkey') AS encrypted;
--   SELECT integrations_decrypt(integrations_encrypt('hello', 'mysecretkey'), 'mysecretkey') AS decrypted;
--   Expected decrypted = 'hello'.
