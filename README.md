# QA Command Center

QA Command Center is a web tool for QA teams to analyze OMS traces, generate AI narratives, validate math/totals, run fast-track business scenarios, and inspect JSON responses in a readable viewer.

## What It Does

- Generate narrative reports from tracer logs (`dev`/`staging`).
- Extract and display vital business data (app-id, email, totals, product context).
- Run AI + deterministic math validation focused on pricing/totals structures.
- Lookup OMS entities by order number, order id, cart id, or sale id.
- Check coupon conflicts before creation (duplicate identifiers + condition overlap).
- Execute guided fast-track scenarios (cart/sale steps) directly from UI.
- Render request/response payloads with a code/tree JSON viewer.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: Node.js, Express
- HTTP: Axios
- AI: Gemini API (with fallback behavior)

## Project Structure

```text
backend/
  src/
    config/
    routes/
    services/
  .env.example

frontend/
  src/
  vite.config.js

add-product-to-cart.json
frontend/add-hotel-product-to-cart.json
```

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Network access to internal OMS services used by your environment

## Setup

1) Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

2) Configure backend environment

```bash
cp backend/.env.example backend/.env
```

Required/important keys in `backend/.env`:

- `PORT` (default `4000`)
- `LOGGING_API_DEV_BASE_URL`
- `LOGGING_API_STAGING_BASE_URL`
- `LOGGING_API_DEFAULT_ENV` (`dev` or `staging`)
- `GEMINI_MODEL` (use: `gemini-3.1-flash-lite-preview`)
- `GEMINI_API_KEY`
- `GEMINI_TIMEOUT_MS` (default: `90000`)

Optional legacy keys:

- `COPILOT_MODEL`
- `COPILOT_API_KEY`

Example:

```env
PORT=4000
LOGGING_API_DEFAULT_ENV=dev
GEMINI_MODEL=gemini-3.1-flash-lite-preview
GEMINI_TIMEOUT_MS=90000
GEMINI_API_KEY=your_key_here
```

## Run Locally

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

The frontend proxies `/api/*` to `http://localhost:4000` (configured in `frontend/vite.config.js`).

## Main API Endpoints

All routes are under `/api/logger`:

- `POST /narrative`
- `POST /lookup`
- `POST /coupon-conflicts`
- `POST /promotion-risk`
- `POST /business-scenario-step`
- `GET /fast-track/scenarios`
- `GET /fast-track/templates/add-flight-product-body`
- `GET /fast-track/templates/add-hotel-product-body`
- `GET /fast-track/templates/prepare-body`
- `POST /fast-track/execute`

Health check:

- `GET /health`

## Fast-Track Scenarios

Fast-track scenarios let QA execute common multi-step flows quickly from UI without manually rebuilding requests in Postman.

Current scenarios:

- `Scenario 1 - Cart + Flight`
  - `createEmptyCart`
  - `addFlightProduct`
- `Scenario 2 - Cart + Hotel`
  - `createEmptyCartHotel`
  - `addHotelProduct`
- `Scenario 3 - Sale + Flight`
  - `createSaleWithFlightProduct`
  - `prepareSaleCheckout`
  - `checkoutSale`

Current backend scenario definitions are exposed by:

- `GET /api/logger/fast-track/scenarios`

Step requests are executed via:

- `POST /api/logger/fast-track/execute`

## Notes

- Cart/sale IDs and totals are propagated across steps when detected in responses.
- Fast-track request headers are standardized for QA runs (`app-id`, `x-currency`, `x-user-email`, `x-user-id`, `Content-Type`).
- If Gemini is unavailable or rate-limited, the backend uses fallback behavior so reports still render.
- If Gemini calls time out, increase `GEMINI_TIMEOUT_MS` and restart backend.

## License

Internal QA tooling (project-specific usage).
