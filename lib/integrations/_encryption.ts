import { getIntegrationsClient } from "./_base";

/**
 * OAuth token encryption через pgcrypto `pgp_sym_encrypt/decrypt`.
 *
 * Master key из `process.env.INTEGRATION_ENCRYPTION_KEY` (32-byte hex,
 * generated `openssl rand -hex 32` и стоит в Vercel env × 3 environments).
 *
 * Storage: bytea column в `integrations` table. Database никогда не видит
 * plaintext — encrypt/decrypt происходит через RPC-style query.
 *
 * **Security note**: master key никогда не должен попадать в logs или
 * client bundle. Эти helpers вызываются ТОЛЬКО из server actions / API
 * routes (используют `createAdminClient()` который read'ит SERVICE_ROLE_KEY).
 */

function getMasterKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY env not set. " +
        "Generate `openssl rand -hex 32` and add to Vercel env (production+preview+development).",
    );
  }
  return key;
}

/**
 * Encrypts plaintext token (e.g. OAuth access_token) → bytea-compatible Buffer.
 * Возвращает `Uint8Array` (Postgres bytea сериализуется как `\x...` hex string,
 * supabase-js переводит в Uint8Array автоматически).
 */
export async function encryptToken(plaintext: string): Promise<Uint8Array> {
  if (!plaintext) {
    throw new Error("encryptToken: plaintext empty — refusing to encrypt");
  }
  const supabase = getIntegrationsClient();
  const key = getMasterKey();
  const { data, error } = await supabase.rpc("integrations_encrypt", {
    p_plaintext: plaintext,
    p_key: key,
  });
  if (error) {
    throw new Error(`encryptToken: RPC failed — ${error.message}`);
  }
  // RPC возвращает bytea как string-hex (`\x...`) или Uint8Array depending on
  // serialization. Normalize в Uint8Array.
  if (typeof data === "string") {
    const hex = data.startsWith("\\x") ? data.slice(2) : data;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  return data as Uint8Array;
}

/**
 * Decrypts bytea ciphertext (из БД) → plaintext.
 * Принимает `Uint8Array | Buffer | string` (hex `\x...` или base64 — supabase-js
 * variants).
 */
export async function decryptToken(
  ciphertext: Uint8Array | Buffer | string,
): Promise<string> {
  if (!ciphertext) {
    throw new Error("decryptToken: ciphertext empty");
  }
  const supabase = getIntegrationsClient();
  const key = getMasterKey();

  // Postgres bytea принимает hex format `\x...`. Если у нас Uint8Array → convert.
  let hexStr: string;
  if (typeof ciphertext === "string") {
    hexStr = ciphertext.startsWith("\\x") ? ciphertext : `\\x${ciphertext}`;
  } else {
    const bytes = ciphertext instanceof Uint8Array ? ciphertext : new Uint8Array(ciphertext);
    hexStr = "\\x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const { data, error } = await supabase.rpc("integrations_decrypt", {
    p_ciphertext_hex: hexStr,
    p_key: key,
  });
  if (error) {
    throw new Error(`decryptToken: RPC failed — ${error.message}`);
  }
  return data as string;
}
