# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an autonomous negotiation agent themed as a **startup Series A funding negotiation** (see `CHALLENGE.md`). The AI bot plays the **founder** seeking investment, and the human plays the **VC investor** proposing term sheets.

**Negotiation terms:**
- Valuation ($M pre-money) — founder wants higher, VC wants lower
- Equity (%) — founder wants to give less, VC wants more
- Board seats — founder wants fewer, VC wants more
- Liquidation preference (x multiple) — founder wants lower, VC wants higher

## Architecture Intent

The system should have these core components:

- **Negotiation Engine** — manages back-and-forth offer/counteroffer flow and state transitions (`pending → countered → accepted/rejected/expired`)
- **Bot (Founder Agent)** — configurable goals/limits, contains the decision logic for accept/counter/reject
- **Negotiation Strategy** — scoring/utility function to evaluate offers across terms (normalize each term to a common scale, apply weights); consider MESO (Multiple Equivalent Simultaneous Offers)
- **UI** — interface for a human (playing VC investor) to negotiate with the bot

## Key Design Notes

- Use a **utility/scoring function** to evaluate multi-term offers: assign weights to each term, normalize values to [0,1], compute a weighted sum. This enables comparing heterogeneous tradeoffs (e.g., lower valuation vs. fewer board seats).
- **MESO**: bot can present multiple equivalent offers simultaneously — same utility to the bot, different term distributions — to reveal the VC's preferences.
- Bot config (ideal valuation, max equity, etc.) should be externalized so strategies are swappable/comparable.

## Stack

- **Frontend:** plain HTML/CSS/JS (`index.html`) — no framework, no build step
- **Backend:** Vercel serverless function (`api/negotiate.js`) — Node.js, CommonJS
- **Deploy:** Vercel (one-click, auto-detects `api/` folder and serves `index.html` as static root)

## Commands

```bash
# Run locally — no dependencies required beyond Node.js
npm run dev       # starts at http://localhost:3000

# Deploy to production
vercel            # requires Vercel CLI: npm i -g vercel
```

There is no build step and no npm dependencies. `server.js` is a thin local wrapper around `api/negotiate.js` using only Node.js built-ins. On Vercel, `api/negotiate.js` is used directly as a serverless function.

## Working Style

Discuss significant coding decisions with the user before implementing them. This includes architectural changes, new abstractions, alternative approaches, and anything that meaningfully affects the structure or behavior of the codebase.

## Git Workflow

Always commit AND push together after completing a significant change or feature. Don't commit minor changes (e.g., removing a progress bar). Wait for the user to confirm they are satisfied with changes before committing — do not commit after each edit.
