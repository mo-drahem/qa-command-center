# QA Command Center

QA Command Center is a web tool for QA teams to analyze OMS traces, generate AI narratives, validate math/totals, run business scenarios against OMS APIs, and inspect JSON responses in a readable viewer.

## What It Does

- Generate narrative reports from tracer logs (`dev`/`staging`).
- Extract and display vital business data (app-id, email, totals, product context).
- Run AI + deterministic math validation focused on pricing/totals structures.
- Lookup OMS entities by order number, order id, cart id, or sale id.
- Check coupon conflicts and simulate promotion risk.
- **Business Scenarios** — discrete OMS actions (rules, cart, sale) with editable request drafts and one-click execute.
- Fast-track multi-step flows (legacy scenario runner).
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
    config/            # OMS hosts, business actions, fast-track steps
    controllers/
    fixtures/          # Rule templates, new-cart shell (contact/payment)
    lib/               # exampleFixtures, cart headers, runtime placeholders
    routes/logger/
    services/
  test/
  .env.example

frontend/
  src/
    components/logger/
    config/              # Vital fields per business action
    domain/

examples/              # Bruno / curl exports — loaded at runtime
  new-cart-with-product-flight.json
  new-cart-with-product-hotel.json
  add-product-to-cart.json
  add-hotel-product-to-cart.json
  prepare-checkout.json
  apply-coupon-to-cart.json
```

### Fixtures policy

| Location | Role |
|----------|------|
| `examples/*.json` | **Runtime** cart/sale bodies (via `backend/src/lib/exampleFixtures.js`) |
| `backend/src/fixtures/*.json` | Rule templates (`createRule.json`), checkout/coupon stubs, `newCartShell.json` |
| `backend/.env` | Secrets and QA identity overrides (`FAST_TRACK_DEFAULT_*`) |

Do not commit real PII or production data. Dev/staging only.

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Network access to internal OMS services (dev/staging hostnames)

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install
cp backend/.env.example backend/.env
```

Important `backend/.env` keys:

- `LOGGING_API_DEV_BASE_URL`, `LOGGING_API_STAGING_BASE_URL`
- `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. `gemini-3.1-flash-lite-preview`)
- `FAST_TRACK_DEFAULT_APP_ID`, `FAST_TRACK_DEFAULT_ENTITY_ID`, `FAST_TRACK_DEFAULT_CLIENT_ID`
- `FAST_TRACK_DEFAULT_USER_EMAIL`, `FAST_TRACK_DEFAULT_USER_ID`, `FAST_TRACK_DEFAULT_USER_PHONE`
- Optional: `QA_CENTER_API_KEY`, `OMS_*_SERVICE_BASE` overrides

## Run Locally

```bash
cd backend && npm run dev    # http://localhost:4000
cd frontend && npm run dev   # http://localhost:5173
```

## Main API Endpoints

All routes under `/api/logger`:

| Endpoint | Purpose |
|----------|---------|
| `POST /narrative` | AI narrative from tracer |
| `POST /lookup` | OMS entity lookup |
| `POST /coupon-conflicts` | Coupon conflict check |
| `POST /promotion-risk` | Promotion risk simulation |
| `GET /business-actions` | Business Scenarios catalog |
| `GET /business-actions/:actionId/draft` | Request template for an action |
| `POST /business-actions/execute` | Execute action (proxy to OMS) |
| `GET /examples` | List loaded `examples/*.json` files |
| `GET /fast-track/scenarios` | Fast-track scenario list |
| `POST /fast-track/execute` | Run a fast-track step |

Health: `GET /health`

## Business Scenarios (UI tab)

Actions are grouped as **Rules & MDR**, **Cart**, and **Sale**. Notable flows:

- **Rules:** create/update rule, get MDR export (`GET …/mdr/export-csv/{rule-id}`) — rule-id is 24-char hex
- **Cart:** `POST /cart/newCartWithProduct` (flight/hotel bodies from `examples/new-cart-with-product-*.json`)
- **Cart (steps):** create empty cart, add product, apply coupon, prepare, checkout
- **Sale:** create with product, prepare, checkout

Runtime fields (`cart-id`, `sale-id`, `rule-id`) update the URL before execute. Headers and body are editable; vital fields stay in sync with JSON.

## Fast-Track Scenarios

- **Scenario 1 / 2:** single step `newCartWithFlightProduct` / `newCartWithHotelProduct`
- **Scenario 3 / 4:** sale + flight/hotel checkout flows
- **Scenario 5 / 6:** cart + coupon / prepare

Definitions: `backend/src/config/fastTrackScenarios.js`

## Tests & CI

```bash
cd backend && npm test
cd frontend && npm run test && npm run lint && npm run build
```

GitHub Actions: `.github/workflows/ci.yml` runs frontend lint/test/build and backend tests.

## Architecture

- `backend/src/routes/logger/` — route wiring
- `backend/src/controllers/` — HTTP orchestration
- `backend/src/config/businessActionRegistry.js` — action drafts + OMS proxy execute
- `frontend/src/api/` — HTTP client
- `frontend/src/domain/` — JSON/vital-field helpers (unit tested)

## License

Internal QA tooling (project-specific usage).
