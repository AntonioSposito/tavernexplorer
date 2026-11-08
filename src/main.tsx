import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { OBR } from "./obr";
import { PhoneApp } from "./PhoneAccess";
import { TokenInitiativePicker } from "./TokenInitiativePicker";
import { TokenHpMenu, TokenMenu } from "./TokenMenu";
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

// Il popover del turn order per i token senza scheda e le tendine del menu del token caricano solo il loro modulo, non l'app intera.
// In locale resta l'anteprima: ?phone prova l'accesso da telefono.
const params = new URLSearchParams(window.location.search);
const preview = OBR.isAvailable || (import.meta.env.DEV && !params.has("phone"));
const page = params.has("initiative") ? <TokenInitiativePicker /> : params.has("token-menu") ? <TokenMenu /> : params.has("token-hp") ? <TokenHpMenu /> : preview ? <App /> : <PhoneApp />;
createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);
