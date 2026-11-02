# Regole UI di TavernExplorer

Preferenze decise con l'utente. Valgono per ogni modifica futura.

## Schede personaggio

- **Creare e modificare sempre in un popup.** Ogni sezione di ogni scheda (azioni, magie, risorse, competenze, buff/debuff, …) apre un `Dialog` per creare o modificare una voce. Niente form o campi di modifica aperti direttamente nella pagina. "Elimina" sta dentro il popup di modifica, non sulla riga.
- **Stessi tasti per tutte le sezioni.** Sulla riga di ogni voce, a destra, i pulsanti di `.entry-icons` con le icone di `src/icons.tsx`, come in Azioni e Magia:
  - `ChatIcon`, `aria-label="Mostra in chat <nome>"`, `title="Mostra in chat"`.
  - `EditIcon`, `aria-label="Modifica <nome>"`, `title="Modifica"`, visibile solo a chi può modificare la scheda.
- **Tutto si può mandare in chat**, con lo stesso tasto delle magie (anche competenze e linguaggi).
- **Ciò che ha un tiro si tira cliccando il nome** (classe `entry-use`), come azioni, magie e strumenti.
- **Form ispirati a Roll20.** Esempio, strumenti: Nome, Bonus competenza (Competente / Maestria / Factotum), Caratteristica (le sei oppure "Chiedi al tiro", cioè QUERY ATTRIBUTE: al clic si sceglie la caratteristica), Mod. Il tiro è `1d20 + caratteristica + competenza + mod` con le etichette.

## Barra delle tab principali

- Solo icone (`public/tab-icons/<tab>.png`), colorate con `mask` e `currentColor`. Il nome della tab va in `aria-label` e `title`.
- Prima le tab che vedono tutti; poi, dopo una linea separatrice, le tab solo GM (Bestiario, Avventure, Permessi).
- I contatori sono badge sovrapposti all'icona, in alto a destra, e spariscono quando valgono 0.
- La tab Messaggi mostra i non letti, contando tutto ciò che compare in chat. Il contatore non sale se la chat è già aperta, anche in una finestra separata.
- La barra non deve mai avere scroll orizzontale.

## Modo di lavorare

- Il lavoro grande va diviso in fasi, con una verifica dopo ogni fase.
