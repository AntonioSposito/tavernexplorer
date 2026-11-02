import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TokenInitiativePicker } from "./TokenInitiativePicker";
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
import "./notes.css";
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

// Il popover del turn order per i token senza scheda carica solo il suo modulo, non l'app intera.
const page = new URLSearchParams(window.location.search).has("initiative") ? <TokenInitiativePicker /> : <App />;
createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);
