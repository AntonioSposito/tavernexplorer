import { useEffect, useState } from "react";

// Icone di game-icons.net in public/icons (CC BY 3.0, crediti in public/icons/CREDITS.md): incantesimi, zaino e card in chat.
// shortcut: solo nomi inglesi e icone parziali, task in docs/tasks.md.
type IconIndex = Record<string, Array<{ name: string; file: string }>>;
const norm = (name: string) => name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
let icons: Promise<Map<string, string>> | null = null;
const loadIcons = () => icons ??= fetch("/icons/icons.json")
  .then((response) => response.json() as Promise<IconIndex>)
  .then((index) => new Map(Object.values(index).flat().map((icon) => [norm(icon.name), `/icons/${icon.file}`])))
  .catch(() => new Map<string, string>());

// Icona per nome inglese (come nel catalogo 5e.tools); "+1 Longsword" usa quella di "Longsword". Senza icona non mostra niente.
export function EntryIcon({ name }: { name: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    void loadIcons().then((map) => { if (alive) setSrc(map.get(norm(name)) ?? map.get(norm(name.replace(/^\+\d+\s+/, "")))); });
    return () => { alive = false; };
  }, [name]);
  return src ? <img className="entry-icon" src={src} alt="" width={28} height={28} loading="lazy"/> : null;
}
