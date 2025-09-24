# AI Fashion Studio

Monorepo per il progetto **AI Fashion Studio** composto da frontend React/Vite e backend Node/Express.

## Requisiti

- Node.js 18+
- pnpm 8+

## Setup

```bash
pnpm install
```

## Avvio

Avviare i servizi in due terminali separati:

```bash
pnpm --filter web dev
pnpm --filter server dev
```

- Frontend disponibile su [http://localhost:5173](http://localhost:5173)
- Backend disponibile su [http://localhost:3001/api/health](http://localhost:3001/api/health)

Entrambi gli ambienti utilizzano variabili in `.env` (non versionate) per configurare le rispettive API.

### Variabili d'ambiente

- `web/.env`: configurare `VITE_API_BASE` se il backend non gira su `/api`.
- `server/.env`: definire `GEMINI_API_KEY=<la tua chiave API Gemini>` (oppure `GOOGLE_API_KEY`). Il backend utilizza il modello **Gemini 2.5 Flash Image Preview** per tutte le operazioni di analisi e generazione immagini.
