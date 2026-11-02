import OBR from "@owlbear-rodeo/sdk";
import { EXTENSION_ID, GM_MESSAGE_KEY } from "./constants";
import type { ChatMessage } from "./types";

const localKey = `${EXTENSION_ID}/gm-message-key/v1`;
type Envelope = { type: "gm-encrypted-v1"; iv: string; body: string; keys: Record<string, string> };
type SavedKeys = { publicKey: JsonWebKey; privateKey: JsonWebKey };

const toBase64 = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function readPrivateKey(): Promise<CryptoKey | null> {
  const saved = localStorage.getItem(localKey);
  if (!saved) return null;
  const keys = JSON.parse(saved) as SavedKeys;
  return crypto.subtle.importKey("jwk", keys.privateKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
}

export async function publishGmMessageKey(): Promise<void> {
  if (!OBR.isAvailable || await OBR.player.getRole() !== "GM") return;
  let saved: SavedKeys | null = null;
  try { saved = JSON.parse(localStorage.getItem(localKey) || "null") as SavedKeys | null; }
  catch { /* Una chiave corrotta viene sostituita. */ }
  if (!saved?.publicKey || !saved.privateKey) {
    const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
    const created = { publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey), privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey) };
    const concurrent = localStorage.getItem(localKey);
    try { saved = concurrent ? JSON.parse(concurrent) as SavedKeys : null; } catch { saved = null; }
    if (!saved?.publicKey || !saved.privateKey) { saved = created; localStorage.setItem(localKey, JSON.stringify(saved)); }
  }
  await OBR.player.setMetadata({ [GM_MESSAGE_KEY]: saved.publicKey });
}

// GM che possono decifrare. OBR.party.getPlayers() esclude chi chiama: un GM da solo non ne ha altri.
export async function gmRecipients() {
  return (await OBR.party.getPlayers()).filter((member) => member.role === "GM" && member.metadata[GM_MESSAGE_KEY]);
}

export async function encryptGmMessage(message: ChatMessage): Promise<Envelope> {
  const gms = await gmRecipients();
  if (!gms.length) throw new Error("Nessun GM pronto a ricevere messaggi riservati. Riprova quando il GM apre l'estensione.");
  const secret = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawKey = await crypto.subtle.exportKey("raw", secret);
  const keys: Record<string, string> = {};
  for (const gm of gms) {
    const publicKey = await crypto.subtle.importKey("jwk", gm.metadata[GM_MESSAGE_KEY] as JsonWebKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    keys[gm.id] = toBase64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey));
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, secret, new TextEncoder().encode(JSON.stringify(message)));
  return { type: "gm-encrypted-v1", iv: toBase64(iv), body: toBase64(body), keys };
}

export async function decryptGmMessage(value: unknown): Promise<ChatMessage | null> {
  if (!value || typeof value !== "object" || (value as Envelope).type !== "gm-encrypted-v1") return null;
  try {
    if (await OBR.player.getRole() !== "GM") return null;
    const envelope = value as Envelope;
    const wrapped = envelope.keys[await OBR.player.getId()];
    const privateKey = wrapped && await readPrivateKey();
    if (!privateKey) return null;
    const raw = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, fromBase64(wrapped));
    const secret = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv) }, secret, fromBase64(envelope.body));
    return JSON.parse(new TextDecoder().decode(plain)) as ChatMessage;
  } catch { return null; }
}

export function isGmEnvelope(value: unknown): boolean {
  return !!value && typeof value === "object" && (value as Envelope).type === "gm-encrypted-v1";
}
