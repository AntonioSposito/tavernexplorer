import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import manifest from "./public/manifest.json";

const OWLBEAR_ORIGIN = "https://www.owlbear.rodeo";
// Fuori da public/: Vite la serve in sviluppo ma non finisce nel build.
const DEV_ICON = "/dev/icon-dev.svg";

// In sviluppo il manifest ha un nome diverso: in Owlbear si distingue dalla versione pubblicata.
// L'icona della barra resta la sagoma: Owlbear la usa come maschera e un'icona a colori diventa un quadrato.
function devManifest(): Plugin {
  return {
    name: "tavernexplorer-dev-manifest",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/manifest.json", (_request, response) => {
        const dev = { ...manifest, name: `${manifest.name} (DEV)`, icon: DEV_ICON, action: { ...manifest.action, title: `${manifest.action.title} (DEV)` } };
        // Questo middleware precede quello CORS di Vite, quindi imposta l'header da sé.
        response.setHeader("Access-Control-Allow-Origin", OWLBEAR_ORIGIN);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(dev, null, 2));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devManifest()],
  server: {
    // Owlbear carica il manifest da localhost durante lo sviluppo.
    cors: { origin: OWLBEAR_ORIGIN },
  },
  build: {
    rollupOptions: {
      input: { app: "index.html", background: "background.html" },
    },
  },
});
