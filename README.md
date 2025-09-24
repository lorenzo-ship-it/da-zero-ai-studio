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
- `server/.env`: opzionale `GEMINI_API_KEY=<la tua chiave API Gemini>` (oppure `GOOGLE_API_KEY`).
  - Se la chiave è presente il backend userà il modello **Gemini 2.5 Flash Image Preview**.
  - In assenza della chiave il server avvierà automaticamente un adattatore mock locale, permettendo di provare il flusso senza chiamate esterne.
