# Burn • NTFLX Engine — replit.md

## Overview

**Burn • NTFLX Engine** is a Netflix account checker web application. Users paste Netflix cookies (in various formats) into the tool, which then validates those cookies against Netflix's API to determine account status, membership type, and other account details. The app supports concurrent checking (up to 10 workers), streaming results via SSE, and optional NFToken-based verification.

The application is built as a full-stack TypeScript monorepo with:
- A **React** frontend (Vite + Chakra UI + shadcn/ui)
- An **Express** backend (Node.js + TypeScript)
- **Replit Auth** (OpenID Connect) for user authentication
- **PostgreSQL** via Drizzle ORM for session and user persistence
- A core **Netflix checking engine** (`server/netflix_checker.cjs`) that makes HTTP requests to Netflix endpoints to validate cookies

The project was migrated from a standalone Express+React setup (see `server/original_server.js`, `attached_assets/`) into a unified Replit-hosted full-stack app with authentication.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend (`client/`)

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side router)
- **UI Libraries**:
  - **Chakra UI v2** — primary component library (dark theme, orange/accent brand colors)
  - **shadcn/ui** (Radix UI primitives + Tailwind CSS) — supplemental components (buttons, cards, dialogs, etc.)
  - **Tailwind CSS** — utility-first styling, configured with CSS variables for theming
- **State & Data Fetching**: TanStack React Query v5
- **Theme**: Dark mode only; custom color palette defined in `client/src/theme.js` and CSS variables in `client/src/index.css`
- **Anti-inspect**: `client/src/antiInspect.js` — JavaScript that blocks browser DevTools access (polls window size, traps debugger statements)
- **Auth Hook**: `client/src/hooks/use-auth.ts` — queries `/api/auth/user`, exposes `user`, `isAuthenticated`, `isLoading`, `logout`

**Entry point**: `client/src/main.tsx` → `client/src/App.tsx`

The main checker UI lives in pages/components not fully shown, but the `App.tsx` sets up `QueryClientProvider`, `TooltipProvider`, and a `wouter` router.

### Backend (`server/`)

- **Framework**: Express (TypeScript, ESM)
- **Entry point**: `server/index.ts` — creates HTTP server, sets up auth middleware, registers routes, serves static files (prod) or proxies Vite (dev)
- **Routes** (`server/routes.ts`):
  - `POST /api/admin/login` — validates `ACCESS_CODE` env var, sets `req.session.isAdmin`
  - `POST /api/check` — main Netflix cookie checking endpoint; supports streamed (SSE) and direct responses; uses `NetflixAccountChecker` from `server/netflix_checker.cjs`
  - `GET /api/auth/user` — returns current authenticated user (Replit Auth)
  - `/api/login`, `/api/logout`, `/api/callback` — Replit OIDC auth flow
- **Netflix Checker Engine**: `server/netflix_checker.cjs` (CommonJS) — core logic adapted from `server/original_server.js` and `attached_assets/main_1773026300503.js`; makes direct HTTP requests to `netflix.com/account` and related endpoints to validate cookies. Cookie sanitization (`/[^\t\x20-\x7e]/g` strip) applied in `fetchAccountHtml` and `getNFToken` to remove emoji/non-ASCII characters that cause HTTP header errors.
- **Checker Helpers**: `server/original_server_helpers.cjs` — `runStreamedCheck` and `runDirectCheck` both use `checker.checkCookie(cookie, checkOptions)` (the full flow including NFToken generation), not the manual fetch-extract-publicResult shortcut. `MAX_WORKER_COUNT = 5`; locked sessions cap at 1 worker.
- **Session**: `express-session` backed by `connect-pg-simple` (PostgreSQL sessions table)
- **Access Control**:
  - `isAdmin` middleware — checks `req.session.isAdmin`
  - `isFindUnlocked` middleware — checks `req.session.findUnlocked`
  - `isAuthenticated` middleware — Replit OIDC passport strategy

### Database (`shared/schema.ts`, `shared/models/auth.ts`)

**ORM**: Drizzle ORM with PostgreSQL dialect (`drizzle-orm/node-postgres`)

**Tables**:
- `settings` — key/value store (`key VARCHAR PK`, `value VARCHAR`) — used for app configuration
- `sessions` — session storage for `connect-pg-simple` (`sid`, `sess JSONB`, `expire TIMESTAMP`)
- `users` — Replit Auth user records (`id UUID PK`, `email`, `first_name`, `last_name`, `profile_image_url`, `created_at`, `updated_at`)

**Migrations**: Drizzle Kit (`drizzle.config.ts`), output to `./migrations/`

### Authentication

**Provider**: Replit OpenID Connect (OIDC)
- Implemented in `server/replit_integrations/auth/replitAuth.ts`
- Uses `openid-client` + `passport` + `passport` OIDC strategy
- OIDC config is memoized (1-hour TTL) against `https://replit.com/oidc`
- Requires env vars: `REPL_ID`, `ISSUER_URL` (defaults to `https://replit.com/oidc`), `SESSION_SECRET`, `DATABASE_URL`
- Sessions stored in PostgreSQL `sessions` table (1-week TTL)
- User records are upserted on each login in `server/replit_integrations/auth/storage.ts`

**Admin access**: Separate session flag (`isAdmin`) set by `POST /api/admin/login` with an `ACCESS_CODE` env var — not tied to Replit Auth.

### Build System

- **Dev**: `tsx server/index.ts` (server) + Vite dev middleware (client HMR via websocket at `/vite-hmr`)
- **Prod**: `script/build.ts` — runs Vite build (client → `dist/public/`), then esbuild bundles server (`server/index.ts` → `dist/index.cjs`); selected heavy deps (axios, drizzle-orm, express, pg, etc.) are bundled in; others are left external

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **PostgreSQL** | Primary database (sessions, users, settings) — must be provisioned, connection via `DATABASE_URL` |
| **Replit OIDC** (`https://replit.com/oidc`) | User authentication provider; requires `REPL_ID` env var |
| **Netflix HTTP APIs** | `netflix.com/account`, `netflix.com/nq/website/memberapi/...`, `android13.prod.ftl.netflix.com/graphql` — checked directly via axios in the checker engine |
| **Google Fonts** | Inter + Manrope fonts loaded in `client/index.html` and CSS |
| **Flaticon UIcons CDN** | Icon set loaded via CDN in `client/index.html` |
| **Drizzle Kit** | DB schema migrations (`drizzle-kit push`) |

**Required Environment Variables**:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Express session secret
- `REPL_ID` — Replit application ID (for OIDC)
- `ISSUER_URL` — OIDC issuer (defaults to `https://replit.com/oidc`)
- `ACCESS_CODE` — Admin passcode for `/api/admin/login`

---

## UI Features (CheckerPage.jsx)

### Result Card Enhancements
- **Expiry countdown badge** (`getExpiryBadge`): shows "X days left" in green/yellow/red beside plan badge in card header based on `nextBilling`
- **Country flag emoji** (`getCountryFlag`): prepends flag emoji to country name in result cards (50+ country mappings)
- **Re-check button** per card: `🔄 Re-check` button posts to `/api/check` with the card's `cookieHeader`; shows live/expired badge for 4 seconds
- **Plan-themed cards**: gold (Premium), silver (Standard), purple (Ultimate) border/glow themes via `getPlanTheme()`

### Results Modal
- **History toggle** `📚` button in modal header: switches to show `accountHistory` (up to 100 entries from localStorage key `netflix-checker:history:v1`). Auto-saves unlocked valid results when modal opens.
- **Sound toggle** `🔔/🔕` in modal header: toggles `soundEnabled` state (persisted in `localStorage` key `netflix-checker:sound`)
- **COPY ALL** button: copies all `cookieHeader` values to clipboard
- **⬇ Save .txt** button: downloads valid cookies as `netflix-valid-YYYY-MM-DD.txt`

### Sound (App.jsx + CheckerPage.jsx)
- `playSuccessChime()`: Web Audio API triple-tone C–E–G chime (523/659/784 Hz sine waves)
- Fires when `result.valid === true` during either scan mode (if soundEnabled)
- `soundEnabled` / `toggleSound` passed as props from App.jsx to CheckerPage

### Live Stats Bar (App.jsx + CheckerPage.jsx)
- During active scanning: animated strip above log showing `✓ X Valid  ✗ Y Invalid  ⏳ Z Left`
- `liveValidCount` and `liveInvalidCount` tracked in App.jsx state, incremented in both `runCheckCore` and `runFindAccountScan` onResult handlers
- Reset to 0 at scan start; passed as props to CheckerPage
- Visible only while `isLoading === true` and `checkProgress.total > 0`

### Cookie Count Indicator (CheckerPage.jsx)
- `detectedCookieCount` useMemo: counts lines in textarea that contain `=` and `;` (cookie format) or start with `{`/`[` (JSON)
- Green badge overlay at top-right corner of textarea, hidden when scanning, hidden when empty

### Account Quality Grade Badge (CheckerPage.jsx)
- `getAccountGrade(result)` helper: scores accounts on plan tier (3/2/1pts), days remaining (+2/+1/-1/-2), and member age (>2 years: +1)
- Grades: S (score≥6, gold), A (≥5, green), B (≥3, blue), C (≥1, yellow), D (<1, red)
- Shown as first badge in the premium card header badge row

### LIVE Pulse Dot (App.jsx + CheckerPage.jsx)
- `liveResultIds` Set in App.jsx: cookieHeaders of results found in the last 30 seconds
- Auto-removes from Set after 30s timeout
- Premium cards check `liveResultIds.has(result.cookieHeader)` and show pulsing 🔴 + "LIVE" text

### Bulk Re-check All (CheckerPage.jsx)
- `bulkRecheckState`: `{ loading, done, total }` tracks progress of batch recheck
- `handleRecheckAll`: fires all rechecks in parallel via `Promise.allSettled`, updates `recheckStates` map per card
- Button in modal header: shows `🔄 All` → `⏳ X/Y` → `✓ Done`; `data-testid="button-recheck-all"`

### CSV Export (CheckerPage.jsx)
- `handleExportCsv`: generates CSV with headers (Email, Plan, Country, Next Billing, Member Since, Payment, Phone, Cookie)
- Properly quote-escapes all values for Excel compatibility
- Downloads as `netflix-valid-YYYY-MM-DD.csv`; `data-testid="button-export-csv"` in modal footer alongside `.txt` download