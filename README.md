# Slab Collection

A personal trading card repository powered by the [Slab API](https://api.slab.dev-jeb.com).

## Setup

1. Sign in at [app.slab.dev-jeb.com](https://app.slab.dev-jeb.com) and create an API key.
2. Copy `.env.example` to `.env.local` and add your key:

```bash
cp .env.example .env.local
```

3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Populate your collection

If you have not added cards yet, use the Slab CLI:

```bash
pip install slab-cli
export SLAB_API_KEY=sk_live_...
slab collector create
slab collection add
```

## Architecture

- **Frontend**: Next.js App Router + Tailwind
- **Backend proxy**: `/api/collection` keeps your API key server-side
- **Data source**: `POST /collectors/{id}/collection/search` on the Slab API

## Roadmap

- Portfolio dashboard (P&L history charts)
- Pull probability / EV calculator (sealed product + odds)
- Break tracker
