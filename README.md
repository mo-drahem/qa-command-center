# QA Command Center

A QA tool that generates a chronological **User Story** from tracer logs using AI summarization.

## Tech Stack

| Layer    | Tech                           |
|----------|-------------------------------|
| Frontend | React + Vite + Tailwind CSS v4 |
| Backend  | Node.js + Express              |
| HTTP     | Axios                          |
| Toast    | react-hot-toast                |
| Config   | .env files                     |

---

## Setup

### Prerequisites
- Node.js ≥ 18

### 1. Clone the repository

```bash
git clone https://github.com/mo-drahem/qa-command-center.git
cd qa-command-center
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your real values:

| Variable                        | Description                                     | Default |
|---------------------------------|-------------------------------------------------|---------|
| `PORT`                          | Port the Express server listens on              | `4000`  |
| `LOGGING_API_DEV_BASE_URL`      | Base URL of the logging service (dev env)       | —       |
| `LOGGING_API_STAGING_BASE_URL`  | Base URL of the logging service (staging env)   | —       |
| `LOGGING_API_DEFAULT_ENV`       | Fallback environment when none is specified     | `dev`   |
| `COPILOT_MODEL`                 | AI model name (e.g. `gpt-4o`)                   | —       |
| `COPILOT_API_KEY`               | API key for the Copilot/AI provider             | —       |

> **Note**: `COPILOT_API_KEY` is optional. When omitted, the backend uses a robust **local fallback summarizer** (see Fallback Behavior below).

### 3. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

---

## Run Commands

### Development

```bash
# Backend (auto-restarts on file change via --watch)
cd backend && npm run dev

# Frontend (Vite dev server with HMR, proxies /api → localhost:4000)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Production Build

```bash
# Build frontend static assets
cd frontend && npm run build

# Start backend in production mode
cd backend && npm start
```

---

## API Contract

### `POST /api/logger/narrative`

**Request body**

```json
{
  "tracerId": "abc-123-xyz",
  "environment": "dev"
}
```

| Field         | Type                   | Required | Description                      |
|---------------|------------------------|----------|----------------------------------|
| `tracerId`    | `string`               | ✅       | Non-empty tracer ID              |
| `environment` | `"dev"` \| `"staging"` | No       | Defaults to `dev`                |

**Success response (200)**

```json
{
  "tracerId": "abc-123-xyz",
  "environment": "dev",
  "story": "## QA Narrative\n...",
  "logs": [
    {
      "serviceName": "auth-service",
      "requestURI": "/api/auth/login",
      "method": "POST",
      "statusCode": 200,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**Error responses**

| Status | Condition                     |
|--------|-------------------------------|
| 400    | `tracerId` missing or empty   |
| 400    | `environment` not dev/staging |
| 500    | Logging service unreachable   |

**Health check**

```
GET /health  →  { "status": "ok" }
```

---

## Fallback Behavior

When the AI provider is unavailable (no API key, rate-limited, or network error), the backend **does not fail the endpoint**. Instead, it returns a locally-generated narrative that includes:

- **Flow Timeline** – all captured API calls in chronological order
- **Stop Point** – the last call made in the trace
- **Error Detection** – any HTTP status codes ≥ 400 are highlighted
- **Reason** – a plain-English explanation of why the fallback was used

Example fallback output:

```
## Fallback QA Narrative *(AI provider unavailable)*

> _Reason: No AI provider API key configured (COPILOT_API_KEY is not set)_

### Flow Timeline
  1. GET /api/users (user-service) — 200 @ 2024-01-15T10:30:01.000Z
  2. POST /api/orders (order-service) — 422 @ 2024-01-15T10:30:02.000Z

### Stop Point
The last captured call was:
- POST /api/orders (order-service) — Status 422 at 2024-01-15T10:30:02.000Z

### ⚠️ Errors Detected
- HTTP 422 on `/api/orders` (order-service) at 2024-01-15T10:30:02.000Z
```

---

## Architecture

```
backend/
  src/
    config/env.js          — Environment config + URL resolver
    services/
      loggingApi.js        — Fetches raw logs from external service
      aiNarrative.js       — AI provider + local fallback summarizer
    routes/
      loggerRoutes.js      — POST /narrative route
    index.js               — Express app + centralized error middleware

frontend/
  src/
    api/
      client.js            — Axios instance (baseURL=/api)
      loggerApi.js         — generateNarrative() API call
    components/
      LoggerView.jsx       — Single-page logger UI
    App.jsx                — Root component with Toaster
    main.jsx               — React entry point
```
