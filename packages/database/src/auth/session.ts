import { createHmac } from "crypto";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
  return secret;
}

function base64urlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString();
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export interface SessionPayload {
  id: number;
}

export function createSessionCookie(payload: SessionPayload): string {
  const encoded = base64urlEncode(JSON.stringify(payload));
  const signature = sign(encoded, getSecret());
  return `${encoded}.${signature}`;
}

export function verifySessionCookie(
  cookie: string
): SessionPayload | null {
  const dotIndex = cookie.indexOf(".");
  if (dotIndex === -1) return null;

  const encoded = cookie.slice(0, dotIndex);
  const signature = cookie.slice(dotIndex + 1);

  const expected = sign(encoded, getSecret());
  if (signature !== expected) return null;

  try {
    const decoded = base64urlDecode(encoded);
    return JSON.parse(decoded) as SessionPayload;
  } catch {
    return null;
  }
}
