import { STORAGE_PHONE_SESSION, STORAGE_PHONE_TABS_ON_TOP, STORAGE_CAMPAIGNS, STORAGE_CHARACTERS, STORAGE_CLOSED_MONSTER_SECTIONS, STORAGE_CLOSED_SPELL_LEVELS, STORAGE_CLOUD_CACHE, STORAGE_EQUIPPED_FIRST, STORAGE_GM_TOKEN, STORAGE_LAST_SHEET, STORAGE_LIBRARY_SORT, STORAGE_MESSAGES, STORAGE_MESSAGES_SEEN, STORAGE_MONSTERS, STORAGE_SHARED_INVENTORY } from "./constants";
import type { CampaignDocument, CharacterSheet, ChatMessage, CloudSheet, MonsterSheet, SharedInventoryItem } from "./types";

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

export interface PhoneSession { room: string; name: string; gmToken?: string }

export const storage = {
  gmToken: {
    get: () => read<string | null>(STORAGE_GM_TOKEN, null),
    set: (value: string) => write(STORAGE_GM_TOKEN, value),
  },
  phoneTabsOnTop: {
    get: () => read<boolean>(STORAGE_PHONE_TABS_ON_TOP, false),
    set: (value: boolean) => { try { write(STORAGE_PHONE_TABS_ON_TOP, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  phoneSession: {
    get: () => read<PhoneSession | null>(STORAGE_PHONE_SESSION, null),
    set: (value: PhoneSession | null) => write(STORAGE_PHONE_SESSION, value),
  },
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
  // Solo cache di lettura della libreria cloud, una per stanza: la fonte di verità resta il server.
  cloudCache: {
    get: (room: string) => read<CloudSheet[]>(`${STORAGE_CLOUD_CACHE}/${room}`, []),
    set: (room: string, value: CloudSheet[]) => write(`${STORAGE_CLOUD_CACHE}/${room}`, value),
    characters: (room: string) => read<CloudSheet[]>(`${STORAGE_CLOUD_CACHE}/${room}`, []).flatMap((entry) => entry.kind === "pc" ? [entry.sheet] : []),
  },
  // Livelli di magie chiusi, come "idScheda:livello": solo comodità di questo browser.
  // Zaino con gli oggetti equipaggiati in cima: solo comodità di questo browser, l'ordine salvato non cambia.
  equippedFirst: {
    get: () => read<boolean>(STORAGE_EQUIPPED_FIRST, false),
    set: (value: boolean) => { try { write(STORAGE_EQUIPPED_FIRST, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  // Libreria in ordine alfabetico: solo comodità di questo browser.
  libraryAlphabetical: {
    get: () => read<boolean>(STORAGE_LIBRARY_SORT, false),
    set: (value: boolean) => { try { write(STORAGE_LIBRARY_SORT, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  // Ultima scheda aperta: si riapre di default. Solo comodità di questo browser.
  lastSheet: {
    get: () => read<string | null>(STORAGE_LAST_SHEET, null),
    set: (value: string) => { try { write(STORAGE_LAST_SHEET, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  closedSpellLevels: {
    get: () => read<string[]>(STORAGE_CLOSED_SPELL_LEVELS, []),
    set: (value: string[]) => { try { write(STORAGE_CLOSED_SPELL_LEVELS, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
  closedMonsterSections: {
    get: () => read<string[]>(STORAGE_CLOSED_MONSTER_SECTIONS, []),
    set: (value: string[]) => { try { write(STORAGE_CLOSED_MONSTER_SECTIONS, value); } catch { /* storage pieno o bloccato: resta in memoria */ } },
  },
};
