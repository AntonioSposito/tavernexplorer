import { useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function Button({ variant = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" }) {
  return <button className={`ui-button ui-button--${variant} ${className}`.trim()} {...props}/>;
}

export function Card({ className = "", ...props }: HTMLAttributes<HTMLElement>) { return <section className={`ui-card ${className}`.trim()} {...props}/>; }
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`ui-input ${className}`.trim()} {...props}/>; }
export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={`ui-select ${className}`.trim()} {...props}/>; }
export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={`ui-textarea ${className}`.trim()} {...props}/>; }
export function Badge({ className = "", ...props }: HTMLAttributes<HTMLSpanElement>) { return <span className={`ui-badge ${className}`.trim()} {...props}/>; }
export function Alert({ tone = "info", className = "", ...props }: HTMLAttributes<HTMLDivElement> & { tone?: "info" | "danger" | "success" }) { return <div role="status" className={`ui-alert ui-alert--${tone} ${className}`.trim()} {...props}/>; }
export function Spinner() { return <span className="ui-spinner" aria-label="Caricamento"/>; }
// Righe grigie al posto di elenchi e form che si stanno caricando.
export function Skeleton({ rows = 3 }: { rows?: number }) { return <div className="ui-skeleton" role="status" aria-label="Caricamento">{Array.from({ length: rows }, (_, index) => <span key={index}/>)}</div>; }

export function Dialog({ open, title, description, children, onClose }: { open: boolean; title: string; description?: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  // Con due popup aperti uno dentro l'altro, Esc chiude solo quello in cima.
  useEffect(() => { if (!open) return; const close = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current === [...document.querySelectorAll(".ui-dialog")].at(-1)) onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [open, onClose]);
  if (!open) return null;
  return <div className="ui-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={ref} className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header><div><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div><Button variant="ghost" aria-label="Chiudi" onClick={onClose}>×</Button></header>{children}</section></div>;
}
