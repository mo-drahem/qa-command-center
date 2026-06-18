# QA Command Center

QA Command Center is a web tool for QA teams to analyze OMS traces, generate AI narratives, validate math/totals, run business scenarios against OMS APIs, and inspect JSON responses in a readable viewer.

## What It Does

- Generate narrative reports from tracer logs (`dev` / `staging` / `production`).
- Extract and display vital business data (app-id, email, totals, product context).
- Run AI + deterministic math validation focused on pricing/totals structures.
- Lookup OMS entities by order number, order id, cart id, or sale id.
- Promotions tab: get rules/coupons and MDR export by rule id (pricing-core / pricing-mdr).
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
| `backend/.env` | Local dev secrets and QA identity overrides (`FAST_TRACK_DEFAULT_*`) |
| `config/config.yaml` | **Production** secrets and settings (mount on server; never commit) |

Do not commit real PII or untrusted production data. Prefer dev/staging for exploratory work.

## Prerequisites

- Node.js 18+ (recommended)
- npm
- Network access to internal OMS services (dev/staging/production hostnames when used)

## Setup

```bash
cd backend && npm install
cd ../frontend && npm install
cp backend/.env.example backend/.env
```

For **local development**, keep using `backend/.env` (see keys below).

For **server deployment**, use YAML instead:

```bash
cp config/config.example.yaml config/config.yaml
# Edit config/config.yaml with real secrets and internal URLs
```

Important config keys (`.env` or `config/config.yaml`):

- `LOGGING_API_DEV_BASE_URL`, `LOGGING_API_STAGING_BASE_URL`, `LOGGING_API_PRODUCTION_BASE_URL` / `logging.devBaseUrl`, `logging.stagingBaseUrl`, `logging.productionBaseUrl`
- `GEMINI_API_KEY`, `GEMINI_MODEL` / `secrets.geminiApiKey`, `ai.geminiModel`
- `FAST_TRACK_DEFAULT_*` / `fastTrack.defaults.*`
- Optional: `QA_CENTER_API_KEY` / `secrets.qaCenterApiKey`, `OMS_*_SERVICE_BASE` / `oms.*ServiceBase`

## Run Locally

```bash
cd backend && npm run dev    # http://localhost:4000
cd frontend && npm run dev   # http://localhost:5173
```

## Deploy on Company Servers

Production uses a **YAML config file** for secrets and settings. Environment variables override YAML when both are set (useful for Kubernetes secret injection).

### 1. Create config

```bash
cp config/config.example.yaml config/config.yaml
```

Edit `config/config.yaml` — at minimum set:

- `secrets.qaCenterApiKey` — API token clients must send as `X-API-Key` (recommended on shared servers)
- `secrets.geminiApiKey` — for AI narrative / math validation
- `logging.devBaseUrl` / `logging.stagingBaseUrl` / `logging.productionBaseUrl` — internal logging service URLs
- `fastTrack.defaults.*` — QA user identity for cart/sale flows

Never commit `config/config.yaml`.

### 2. Docker (recommended)

```bash
docker build -t qa-command-center .
docker run -d \
  -p 4000:4000 \
  -v /path/on/server/config.yaml:/etc/qa-command-center/config.yaml:ro \
  qa-command-center
```

Or with Compose (expects `config/config.yaml` on the host):

```bash
docker compose up -d --build
```

The container serves the React UI and API on port **4000** (`server.serveFrontend: true`).

### 3. Bare-metal / VM

```bash
cd frontend && npm ci && npm run build
cd ../backend && npm ci --omit=dev
export NODE_ENV=production
export QA_CENTER_CONFIG_PATH=/etc/qa-command-center/config.yaml
node backend/src/index.js
```

Mount or copy your `config.yaml` to `QA_CENTER_CONFIG_PATH`.

### Config reference

| YAML path | Env override | Purpose |
|-----------|--------------|---------|
| `server.port` | `PORT` | HTTP port (default 4000) |
| `server.serveFrontend` | `SERVE_FRONTEND` | Serve built UI from backend |
| `secrets.qaCenterApiKey` | `QA_CENTER_API_KEY` | Protect `/api` routes |
| `secrets.geminiApiKey` | `GEMINI_API_KEY` | Gemini AI |
| `secrets.copilotApiKey` | `COPILOT_API_KEY` | Optional Copilot fallback |
| `logging.*` | `LOGGING_API_*` | Tracer logging hosts |
| `ai.*` | `GEMINI_*`, `COPILOT_*` | AI model settings |
| `fastTrack.defaults.*` | `FAST_TRACK_DEFAULT_*` | Default QA identity |
| `oms.*ServiceBase` | `OMS_*_SERVICE_BASE` | OMS host overrides |

## Main API Endpoints

All routes under `/api/logger`:

| Endpoint | Purpose |
|----------|---------|
| `POST /narrative` | AI narrative from tracer |
| `POST /lookup` | OMS entity lookup |
| `POST /promotions/rules` | List pricing rules |
| `POST /promotions/rule` | Get rule by id |
| `POST /promotions/coupons` | List coupons |
| `POST /promotions/coupon` | Get coupon by id |
| `POST /promotions/mdr` | Get MDR export CSV for a rule |
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

## Tests

```bash
cd backend && npm test
cd frontend && npm run test && npm run lint && npm run build
```

## Architecture

- `backend/src/routes/logger/` — route wiring
- `backend/src/controllers/` — HTTP orchestration
- `backend/src/config/businessActionRegistry.js` — action drafts + OMS proxy execute
- `frontend/src/api/` — HTTP client
- `frontend/src/domain/` — JSON/vital-field helpers (unit tested)

## License

Internal QA tooling (project-specific usage).
