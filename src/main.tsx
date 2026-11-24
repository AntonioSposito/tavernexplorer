import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { STORAGE_CAMPAIGNS } from "./constants";
import { LoadError } from "./LazyBoundary";
import { OBR } from "./obr";
import { Spinner } from "./ui";
import "./styles.css";
import "./extended.css";
import "./theme.css";
import "./dialog.css";
import "./permissions.css";
import "./party.css";
import "./editor.css";
import "./assignment.css";
import "./hitPoints.css";
import "./floating.css";
import "./refresh.css";
import "./effects.css";
import "./resources.css";
import "./turns.css";
import "./library.css";
import "./rollCards.css";
import "./core.css";

if (import.meta.env.DEV) {
  document.documentElement.dataset.env = "dev";
  void import("./dev.css");
}

// Le Avventure non ci sono più: i libri importati occupavano MB nella memoria del browser.
try { localStorage.removeItem(STORAGE_CAMPAIGNS); } catch { /* storage bloccato: niente da liberare */ }

// Il popover del turn order per i token senza scheda e le tendine del menu del token caricano solo il loro modulo, non l'app intera.
// In locale resta l'anteprima: ?phone prova l'accesso da telefono.
const params = new URLSearchParams(window.location.search);
// Subito, non a file caricato: la tendina non deve lampeggiare con lo sfondo dell'app.
if (params.has("token-menu") || params.has("token-hp")) document.documentElement.classList.add("token-menu-page");
const preview = OBR.isAvailable || (import.meta.env.DEV && !params.has("phone"));
// Ogni pagina è un file a parte: i popover dei token non scaricano l'app intera.
// Senza Suspense: React terrebbe il caricamento a schermo almeno 300 ms, troppi per la tendina del tasto destro.
const loadPage = async (): Promise<ReactNode> => {
  if (params.has("initiative")) { const { TokenInitiativePicker } = await import("./TokenInitiativePicker"); return <TokenInitiativePicker/>; }
  if (params.has("token-menu")) { const { TokenMenu } = await import("./TokenMenu"); return <TokenMenu/>; }
  if (params.has("token-hp")) { const { TokenHpMenu } = await import("./TokenMenu"); return <TokenHpMenu/>; }
  if (preview) { const { default: App } = await import("./App"); return <App/>; }
  const { PhoneApp } = await import("./PhoneAccess");
  return <PhoneApp/>;
};
const root = createRoot(document.getElementById("root")!);
root.render(<Spinner/>);
loadPage().then((page) => root.render(<StrictMode>{page}</StrictMode>), (error: unknown) => { console.error(error); root.render(<LoadError/>); });
