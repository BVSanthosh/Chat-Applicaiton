# Chatcast

Real-time one-to-one chat running on a **single Cloudflare Worker**: the built
React frontend is served as static assets, and the API lives on the same origin
under `/api/*`, backed by D1 and a Durable Object.

## Architecture

| Concern | Implementation |
| --- | --- |
| Frontend | React + Vite + Tailwind/daisyUI, served as Worker static assets |
| API | Same Worker, Hono router, mounted at `/api/*` |
| Database | Cloudflare D1 (SQLite) |
| Realtime | Durable Object with hibernatable WebSockets |
| Auth | HttpOnly, SameSite=Lax session cookie carrying an HS256 JWT (WebCrypto) |
| Passwords | PBKDF2-SHA256, with legacy bcrypt verified and upgraded on login |
| Images | Cloudinary REST API, signed with WebCrypto |

Socket.IO, Express and Mongoose were removed — none of them run on Workers. The
client uses a plain `WebSocket` with its own reconnect/backoff and heartbeat.

Because the frontend and API share an origin there is no CORS layer, no origin
allowlist to keep in sync across deploys, and no build-time API URL.

### Request routing

`run_worker_first = ["/api/*"]` in `wrangler.toml` is what makes this work.
Without it, `not_found_handling = "single-page-application"` would catch `/api/*`
(which matches no asset) and serve `index.html` instead of reaching the router.

| Request | Served by |
| --- | --- |
| `/api/*` | The Worker |
| `/assets/*`, `/logo.png`, … | Asset store, immutable caching |
| `/`, `/profile`, any other path | `index.html` (SPA shell) |

### How realtime works

Browsers cannot set headers on a WebSocket handshake, so the client exchanges its
session cookie for a 60-second, single-purpose ticket (`GET /api/realtime/ticket`)
and passes that in the socket URL. The Worker verifies the ticket and hands the
connection to a single `PresenceRoom` Durable Object, which tags each socket with
its user id. Presence is "which tags are connected"; delivery is a tag lookup.

---

## Prerequisites

- Node.js 20+
- A Cloudflare account (`npx wrangler login`)
- Optional: a Cloudinary account for image uploads

## First-time setup

```bash
npm run install:all
```

### 1. Create the D1 database

```bash
npx wrangler d1 create chatcast
```

Copy the printed `database_id` into `wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`.

### 2. Apply migrations

```bash
npm run db:migrate:remote
```

Use `npm run db:migrate:local` for the local development database.

### 3. Set secrets

```bash
npx wrangler secret put JWT_SECRET
```

`JWT_SECRET` must be at least 32 characters — the Worker refuses to serve
without it. Generate one with:

```bash
node -e "console.log(crypto.randomUUID()+crypto.randomUUID())"
```

Image uploads additionally need:

```bash
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

These three are optional and all-or-nothing. Leave them unset and upload
endpoints return a clear `503`; text chat is unaffected.

---

## Deploying

```bash
npm run deploy
```

That builds the frontend and deploys the Worker with it. One command, one URL,
one rollback — there is nothing to configure afterwards.

---

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in `JWT_SECRET`, then:

```bash
npm run dev
```

This runs the Worker on `http://localhost:8787` and Vite on
`http://localhost:5173`. Vite proxies `/api` (HTTP and WebSocket) to the Worker,
so the browser sees one origin in development exactly as it does in production.
Use `http://localhost:5173` — that is the one with hot reload.

To exercise the real production path instead (Worker serving the built assets,
no Vite):

```bash
npm run preview
```

Seed some demo accounts:

```bash
npm run db:seed:local
```

The script prints the shared password for the demo accounts. (The old Mongo seed
wrote plaintext passwords, so none of its accounts could ever log in.)

---

## Migrating from the old MongoDB deployment

```bash
mongoexport --uri "$MONGODB_URI" --collection users    --jsonArray --out users.json
mongoexport --uri "$MONGODB_URI" --collection messages --jsonArray --out messages.json

npm run migrate:mongo -- --users users.json --messages messages.json
npx wrangler d1 execute chatcast --remote --file migration.sql
```

Mongo ObjectIds are kept as D1 primary keys so message references survive.
bcrypt password hashes carry over and are verified as-is; each user's hash is
transparently upgraded to PBKDF2 the next time they log in.

---

## Configuration reference

Set in `wrangler.toml` under `[vars]`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `production` | `development` drops the cookie `Secure` flag so local http works |
| `COOKIE_SAMESITE` | `lax` | `lax`, `strict` or `none`; `none` forces `Secure` |
| `PBKDF2_ITERATIONS` | `100000` | Password hashing cost |
| `MAX_UPLOAD_BYTES` | `5242880` | Rejected before the image reaches Cloudinary |

Secrets (`wrangler secret put`): `JWT_SECRET`, and optionally
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

The frontend has no secrets and no environment configuration — it calls its own
origin.

### A note on Workers CPU limits

`PBKDF2_ITERATIONS` defaults to 100,000, roughly the cost of the bcrypt settings
this app used before. That is comfortable on the Workers Paid plan. The Workers
Free plan caps CPU per invocation much lower, so if signup or login returns
"Exceeded CPU limit", lower this value — it is the only request-time cost that
scales with it.

---

## API

All responses use `{ "message": "..." }` for errors. Authentication is the
`token` cookie. Every state-changing request must carry an `Origin` header
matching the Worker's own origin (browsers do this automatically).

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | – | Liveness check |
| `POST` | `/api/auth/signup` | – | Rate limited per IP |
| `POST` | `/api/auth/login` | – | Rate limited per IP |
| `POST` | `/api/auth/logout` | – | Clears the session cookie |
| `GET` | `/api/auth/check` | ✓ | Current user |
| `PUT` | `/api/auth/update-profile` | ✓ | `{ profilePic }` as a base64 data URI |
| `GET` | `/api/messages/users` | ✓ | Everyone except you |
| `GET` | `/api/messages/:id` | ✓ | Conversation, oldest first, capped at 200 |
| `POST` | `/api/messages/send/:id` | ✓ | `{ text?, image? }` |
| `GET` | `/api/realtime/ticket` | ✓ | Short-lived WebSocket ticket |
| `GET` | `/api/realtime` | ticket | WebSocket upgrade |

### WebSocket frames

Server to client:

```jsonc
{ "type": "onlineUsers", "users": ["<userId>", ...] }
{ "type": "newMessage",  "message": { "_id": "...", "senderId": "...", ... } }
{ "type": "pong" }
```

Client to server: `{ "type": "ping" }` only. Chat messages are created through
the authenticated HTTP API, never over the socket.

---

## Layout

```
wrangler.toml        the single Worker: assets + API + D1 + Durable Object
.dev.vars            local secrets (gitignored)
backend/src/         Worker source — routes, middleware, D1 access, Durable Object
backend/migrations/  D1 schema migrations
backend/scripts/     seeding and the one-off Mongo import
frontend/            React app; `npm run build` output is what the Worker serves
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Worker + Vite with HMR |
| `npm run preview` | Build, then serve the production path locally |
| `npm run build` | Production frontend build |
| `npm run lint` | ESLint over the frontend |
| `npm run deploy` | Build and deploy the Worker |
| `npm run db:migrate:remote` | Apply D1 migrations to the remote database |
| `npm run db:seed:remote` | Seed demo users into the remote database |
