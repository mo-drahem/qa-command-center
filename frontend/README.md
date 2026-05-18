# QA Command Center Frontend

## Purpose

This app provides QA operators with three main tools:

- Narrative generation from tracing logs.
- OMS entity lookup.
- Fast-track multi-step business scenarios.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run test
npm run build
```

## Architecture Notes

- API calls are centralized in `src/api/`.
- Reusable domain helpers are in `src/domain/`.
- Fast-track default identity values use explicit QA-safe placeholders from `src/config/fastTrackDefaults.js`.

## Data Safety

- Do not commit real customer identifiers, payment card data, CVV, or bank details.
- Keep fixture values synthetic (`qa.user@example.com`, `qa-user-id`, etc.).
