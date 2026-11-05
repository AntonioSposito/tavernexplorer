declare const process: { env: Record<string, string | undefined> };

const encoder = new TextEncoder();
const hmacKey = (password: string) => crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

// Prova di essere il GM per una stanza: deriva da PHONE_GM_PASSWORD, quindi cambiarla invalida i token già dati.
export async function gmToken(room: string, password: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(password), encoder.encode(room));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// crypto.subtle.verify confronta in tempo costante.
export async function isGmToken(room: string, token: string | null): Promise<boolean> {
  const password = process.env.PHONE_GM_PASSWORD;
  if (!password || !token || !/^[0-9a-f]{64}$/.test(token)) return false;
  const signature = Uint8Array.from(token.match(/../g)!, (byte) => parseInt(byte, 16));
  return crypto.subtle.verify("HMAC", await hmacKey(password), signature, encoder.encode(room));
}
