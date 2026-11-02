import { useEffect, useState } from "react";
import { Dialog, Input } from "./ui";

// Ricerca in un elenco lungo (manuali, avventure, oggetti 5e.tools).
export function CatalogDialog({ open, title, description, items, selectedId, onSelect, onClose }: { open: boolean; title: string; description: string; items: Array<{ id: string; label: string; detail: string }>; selectedId: string; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  useEffect(() => { if (open) setQuery(""); }, [open]);
  const visible = items.filter((item) => `${item.label} ${item.detail}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <Dialog open={open} title={title} description={description} onClose={onClose}><div className="catalog-search"><Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digita per cercare…" aria-label="Cerca nel catalogo"/></div><div className="catalog-list">{visible.map((item) => <button className={`catalog-option ${item.id === selectedId ? "active" : ""}`} key={item.id} onClick={() => onSelect(item.id)}><strong>{item.label}</strong><small>{item.detail}</small></button>)}{visible.length === 0 && <div className="catalog-empty">Nessun risultato</div>}</div></Dialog>;
}
