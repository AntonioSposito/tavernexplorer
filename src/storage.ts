import { STORAGE_CAMPAIGNS, STORAGE_CHARACTERS, STORAGE_CLOSED_SPELL_LEVELS, STORAGE_CLOUD_CACHE, STORAGE_MESSAGES, STORAGE_MESSAGES_SEEN, STORAGE_MONSTERS, STORAGE_NOTES, STORAGE_NOTE_ORGANIZATION, STORAGE_SHARED_INVENTORY } from "./constants";
import type { CampaignDocument, CharacterSheet, ChatMessage, CloudSheet, MonsterSheet, NoteOrganization, PlayerNote, SharedInventoryItem } from "./types";

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  characters: {
    get: () => read<CharacterSheet[]>(STORAGE_CHARACTERS, []),
    set: (value: CharacterSheet[]) => write(STORAGE_CHARACTERS, value),
  },
  messages: {
    get: () => read<ChatMessage[]>(STORAGE_MESSAGES, []).slice(-200),
    set: (value: ChatMessage[]) => write(STORAGE_MESSAGES, value.slice(-200)),
  },
  // createdAt dell'ultimo messaggio letto: alla prima apertura la cronologia non conta come non letta.
  messagesSeen: {
    get: () => read<number>(STORAGE_MESSAGES_SEEN, Date.now()),
    set: (value: number) => { try { write(STORAGE_MESSAGES_SEEN, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  monsters: {
    get: () => read<MonsterSheet[]>(STORAGE_MONSTERS, []),
    set: (value: MonsterSheet[]) => write(STORAGE_MONSTERS, value),
  },
  campaigns: {
    get: () => read<CampaignDocument[]>(STORAGE_CAMPAIGNS, []),
    set: (value: CampaignDocument[]) => write(STORAGE_CAMPAIGNS, value),
  },
  sharedInventory: {
    get: () => read<SharedInventoryItem[]>(STORAGE_SHARED_INVENTORY, []),
    set: (value: SharedInventoryItem[]) => write(STORAGE_SHARED_INVENTORY, value),
  },
  notes: {
    get: () => read<PlayerNote[]>(STORAGE_NOTES, []),
    set: (value: PlayerNote[]) => write(STORAGE_NOTES, value),
  },
  noteOrganization: {
    get: () => read<NoteOrganization>(STORAGE_NOTE_ORGANIZATION, { folders: [], placements: {} }),
    set: (value: NoteOrganization) => write(STORAGE_NOTE_ORGANIZATION, value),
  },
  // Solo cache di lettura della libreria cloud, una per stanza: la fonte di verità resta il server.
  cloudCache: {
    get: (room: string) => read<CloudSheet[]>(`${STORAGE_CLOUD_CACHE}/${room}`, []),
    set: (room: string, value: CloudSheet[]) => write(`${STORAGE_CLOUD_CACHE}/${room}`, value),
    characters: (room: string) => read<CloudSheet[]>(`${STORAGE_CLOUD_CACHE}/${room}`, []).flatMap((entry) => entry.kind === "pc" ? [entry.sheet] : []),
  },
  // Livelli di magie chiusi, come "idScheda:livello": solo comodità di questo browser.
  closedSpellLevels: {
    get: () => read<string[]>(STORAGE_CLOSED_SPELL_LEVELS, []),
    set: (value: string[]) => { try { write(STORAGE_CLOSED_SPELL_LEVELS, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
};
