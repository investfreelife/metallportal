/**
 * Yandex Cloud Object Storage — S3-compatible client (server-only).
 *
 * Sergey fix 2026-05-17: после YC migration designer upload не работал —
 * upload-image API писал в Supabase site-images bucket, frontend rewrite'ил
 * URL → YC bucket где файла нет → 404 на новых photos.
 *
 * Fix: upload направить сразу в YC bucket `harlansteel-images`.
 * URL path matches existing CDN mirror (`site-images/site/<file>`) — imageCdn.ts
 * не нужно менять.
 *
 * Auth: static S3 access keys (YC_S3_KEY_ID + YC_S3_SECRET) из .env.local.
 * Sigv4 — minimal pure-fetch implementation (no aws-sdk dep).
 */

import { createHash, createHmac } from "crypto";

const REGION = "ru-central1";
const ENDPOINT = "storage.yandexcloud.net";
const SERVICE = "s3";

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function deriveSigningKey(secret: string, date: string): Buffer {
  const kDate = hmacSha256("AWS4" + secret, date);
  const kRegion = hmacSha256(kDate, REGION);
  const kService = hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "aws4_request");
}

/**
 * PUT object к YC bucket. Returns public URL.
 * Throws on non-2xx response.
 */
export async function ycPutObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const accessKey = process.env.YC_S3_KEY_ID;
  const secretKey = process.env.YC_S3_SECRET;
  if (!accessKey || !secretKey) {
    throw new Error("YC_S3_KEY_ID / YC_S3_SECRET not configured");
  }

  // Path-style URL: storage.yandexcloud.net/<bucket>/<key>.
  // Virtual-host style (<bucket>.storage.yandexcloud.net) DNS resolves к
  // wrong IP внутри YC Serverless Container (наблюдалось 8.47.69.0:443 timeout
  // 2026-05-17). Path-style uses well-known apex host — reliable DNS.
  // Public URL returned (для frontend consumption) — virtual-host style работает
  // в browser (DNS resolution в external networks). Только server-side fetch
  // нуждается в path-style.
  const host = ENDPOINT;
  const path = `/${bucket}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host,
    "content-type": contentType,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    "x-amz-acl": "public-read",
  };

  const signedHeadersList = Object.keys(headers).sort();
  const canonicalHeaders =
    signedHeadersList.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = signedHeadersList.join(";");

  const canonicalRequest = [
    "PUT",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(secretKey, dateStamp);
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${path}`;
  // Buffer → Uint8Array — fetch BodyInit accepts ArrayBufferView, not Node Buffer
  // directly (TypeScript narrowing). Functionally identical at runtime.
  const bodyView = new Uint8Array(body);
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: bodyView,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YC PUT ${res.status}: ${text.slice(0, 500)}`);
  }

  return `https://${host}/${key}`;
}
