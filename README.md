# XArena — Play. Compete. Win.

A mobile-first esports tournament platform: tournaments, wallet, payments, referrals, leaderboards, and a full admin dashboard.

This build runs **entirely locally** with a built-in SQLite database — no external accounts, API keys, or cloud services are required to install it and click around. Payments (Razorpay) and a few admin actions (email delivery) are wired with real integration code but stay inactive until you add your own credentials — see [Production credentials](#production-credentials-not-included) at the bottom.

---

## Tech stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, React Query, React Hook Form + Zod
- **Backend:** Next.js API routes, SQLite (via `better-sqlite3`) for local dev, JWT-based auth
- **Database schema:** `prisma/schema.prisma` is the canonical, production-target schema (PostgreSQL). Local dev runs against a hand-written SQLite mirror (`src/server/db/schema.sql`) with identical tables/columns/constraints — see [Moving to Postgres](#moving-to-postgres-in-production) below.
- **Payments:** Razorpay SDK (real integration, inactive without your API keys)

---

## Windows + VS Code — exact setup steps

These steps were verified against this project's actual `package.json` and folder structure — every command below is copy-pasteable as-is.

### 1. Extract the ZIP
Right-click `XArena-Final-VSCode.zip` → **Extract All…** → choose a simple path like `C:\Projects\XArena` (avoid extracting into a path with spaces or very deep nesting).

### 2. Open the folder in VS Code
Open VS Code → **File → Open Folder…** → select the extracted `XArena` folder.

### 3. Open the VS Code terminal
**Terminal → New Terminal** (or `` Ctrl+` ``). This opens PowerShell by default on Windows — all commands below work in PowerShell, cmd.exe, or Git Bash.

### 4. Check your Node.js version
```
node -v
```
You need **Node.js 20.x or later** (Node 22 LTS recommended). If you don't have it, download the LTS installer from [nodejs.org](https://nodejs.org) and re-open VS Code's terminal after installing.

> **Why it matters:** this project uses `better-sqlite3`, a native module that ships a ready-to-use prebuilt binary for Windows — this project's included `.npmrc` tells npm to use that directly instead of trying to compile it, so you do **not** need Visual Studio or any C++ build tools installed.

### 5. Install dependencies
```
npm install
```
This reads the included `package-lock.json`, so you'll get the exact same dependency versions this build was tested with. Takes 1–3 minutes.

### 6. Create your `.env` file
Copy the example file:
```
copy .env.example .env
```
*(On Git Bash / macOS / Linux, use `cp .env.example .env` instead.)*

### 7. Fill in environment variables
Open the new `.env` file in VS Code. **For local development, you don't need to change anything** — it already has working defaults for the database and auth secrets. Leave the Razorpay/Firebase/SMTP sections blank; the app runs fully without them (deposits will show a clear "payments not configured" message instead of failing). See [Environment variables reference](#environment-variables-reference) below for what each one does.

### 8. Initialize the local database
```
npm run db:seed
```
This creates `data/xarena.db` automatically (the folder and file don't need to exist beforehand) and populates it with:
- 7 games (Free Fire MAX, BGMI, PUBG Mobile, COD Mobile, Valorant, eFootball, Cricket League)
- 6 sample tournaments in different states
- An admin account and 4 sample player accounts (see [Admin/user login](#adminuser-login) below)
- Sample transactions, notifications, referrals, a support ticket, and homepage banners

The seed is **idempotent** — running it again never creates duplicates, it only fills in what's missing.

### 9. Start the development server
```
npm run dev
```
Wait for the terminal to show `✓ Ready`.

### 10. Open the app in your browser
```
http://localhost:3000
```

### 11. Log in
See [Admin/user login](#adminuser-login) below for the seeded accounts.

### 12. Stop the server
Click into the terminal and press:
```
Ctrl + C
```
If it asks `Terminate batch job (Y/N)?`, type `Y` and press Enter.

### 13. If port 3000 is already in use
Next.js will usually auto-pick the next free port (3001, 3002, …) and print the actual URL in the terminal — check that line. To force a specific port instead:
```
npm run dev -- -p 3005
```
Then open `http://localhost:3005`.

---

## Database setup command

```
npm run db:seed
```
Creates and populates `data/xarena.db` (SQLite, file-based — no separate database server to install or run).

To wipe and start over:
```
npm run db:reset
```
This deletes the local database file and re-seeds it in one step (works identically on Windows, macOS, and Linux).

---

## Seed command

```
npm run db:seed
```
Safe to run multiple times — it checks for existing records before inserting, so it never creates duplicates.

---

## Admin / user login setup

The seed script creates these accounts. **Change these passwords before any real deployment** — they're for local development only.

| Role | Email | Password |
|---|---|---|
| Admin (Super Admin) | `admin@xarena.app` | `Admin@12345` |
| Player | `demo@xarena.app` | `Demo@12345` |
| Player | `shadowstrike@xarena.app` | `Player@12345` |
| Player | `nightowl@xarena.app` | `Player@12345` |
| Player | `ferociousfox@xarena.app` | `Player@12345` |

- **Player login:** `http://localhost:3000/login`
- **Admin dashboard:** `http://localhost:3000/admin` (log in with the admin account above first — the admin routes check your account role and redirect non-admins back to the home page)

To create additional admin accounts, sign up normally through `/signup`, then promote the account's `role` to `ADMIN` or `SUPER_ADMIN` directly in the database (a UI for this doesn't exist yet — it's an intentionally rare, high-privilege action).

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server with hot reload |
| `npm run build` | Create a production build |
| `npm run start` | Run the production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler in check-only mode |
| `npm run db:seed` | Create/populate the local database |
| `npm run db:reset` | Wipe and re-seed the local database |

---

## Common errors & fixes

**`npm install` fails on `better-sqlite3` with a "Could not find any Visual Studio installation" or node-gyp error**
This project includes a `.npmrc` that should prevent this automatically (it tells npm to skip native rebuild scripts and use `better-sqlite3`'s bundled prebuilt binary instead — no compiler needed). If you still hit this error:
1. Delete the `node_modules` folder.
2. Run `npm install --ignore-scripts` explicitly.
3. Continue with the rest of the setup as normal.

This is safe and does not affect `npm run dev`/`build`/etc. — only Visual Studio Build Tools is avoided, nothing else changes. (Installing the full "Desktop development with C++" workload also fixes it, but is a multi-GB download and unnecessary here.)

**Browser shows "This site can't be reached" after `npm run dev`**
Wait for the terminal to actually print `✓ Ready` — the server isn't listening until then. Also confirm you're using the exact URL/port shown in the terminal, not assuming 3000.

**Login says "Incorrect email or password" for the seeded accounts**
Confirm you ran `npm run db:seed` successfully (check the terminal output listed the accounts) and that you're typing the password exactly, including the `@` and capital letter.

**Changes to `.env` don't seem to take effect**
Stop the dev server (`Ctrl+C`) and restart it with `npm run dev` — environment variables are only read at server startup.

**Port 3000 already in use**
See [step 13](#13-if-port-3000-is-already-in-use) above.

**Deposit button shows "Payments aren't configured yet"**
Expected — this means `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` aren't set in `.env`. Everything else in the app works without them; see [Production credentials](#production-credentials-not-included).

---

## Environment variables reference

All variables live in `.env` (create it from `.env.example`). None are required for local development except the first two, which already have working defaults.

| Variable | Required for local dev? | Purpose |
|---|---|---|
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | No (defaults provided) | Signs login session tokens. Change to random strings before production. |
| `DATABASE_URL` | No | Reserved for the future Postgres migration (see below). Local SQLite always lives at `data/xarena.db` regardless of this value. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | No | Enables real money deposits/withdrawals. Without these, the wallet UI works but shows a clear "not configured" message on deposit attempts. |
| `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` | No | Not used yet — reserved for a planned migration to Firebase Auth/Storage/push notifications. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | Enables emailing a reset password to users. Without it, admins see the temporary password directly and relay it manually. |

---

## Production credentials (not included)

This ZIP intentionally contains **no real secrets, API keys, or production credentials** — you must supply your own before deploying:

1. **Razorpay** — a live/test account and API keys from [dashboard.razorpay.com](https://dashboard.razorpay.com/app/keys), plus a webhook secret for automated payment confirmation.
2. **A production PostgreSQL database** — see below.
3. **Firebase project** (optional/future) — only needed if you migrate off the current JWT auth to Firebase Authentication, Storage, or push notifications.
4. **SMTP or a transactional email provider** (e.g. Resend, SendGrid) — only needed for automated password-reset emails.
5. **Hosting + domain** — e.g. Vercel, Railway, or your own server, plus a custom domain and TLS certificate.
6. **New, random `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`** values — do not reuse the local development defaults in production.

### Moving to Postgres in production

`prisma/schema.prisma` is already written for PostgreSQL and requires no model changes. On a machine with unrestricted network access:

```
npm install -D prisma
npm install @prisma/client
```
Set `DATABASE_URL` in `.env` to a real `postgres://` connection string, then:
```
npx prisma migrate dev --name init
```
The API routes currently query SQLite directly (`src/server/db/client.ts` and the routes under `src/app/api/`) — migrating them to use Prisma Client instead of raw SQL is the remaining step for a full production backend, following the same table/column names already defined in the schema.

---

## Project structure

```
xarena/
├── prisma/schema.prisma       # Canonical production (Postgres) data model
├── scripts/
│   ├── seed.ts                 # Database seed script
│   └── reset-db.ts             # Cross-platform DB reset helper
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login, signup — no nav chrome
│   │   ├── (main)/             # All user-facing pages — with nav chrome
│   │   ├── admin/               # Admin dashboard — sidebar layout, role-gated
│   │   └── api/                 # All backend routes (auth, wallet, tournaments, admin/*)
│   ├── components/              # Reusable UI (cards, dialogs, nav, etc.)
│   ├── hooks/                   # React Query hooks — one per resource
│   ├── lib/                     # Client-side utilities (API client, formatting)
│   ├── server/
│   │   ├── db/                  # SQLite schema + connection
│   │   └── lib/                 # Server-only utilities (auth, money, audit log, Razorpay)
│   └── types/                   # Shared Zod validation schemas
├── data/                        # SQLite database file (created on first seed)
├── .env.example                 # Environment variable template — copy to .env
└── package.json
```

## Manual UPI deposits (QR + UTR + admin verification)

Users: **Wallet → Add Money** → pick amount → scan admin-configured QR → enter UTR + upload screenshot → request is `PENDING`.
The wallet is credited **only** when an admin approves it at **Admin → Deposit Requests** (single atomic DB transaction:
status → `APPROVED`, wallet +amount, `DEPOSIT` ledger row `UPI-<UTR>`, user notification, audit log).

**Required one-time setup:** log in as admin → **Admin → Payment Settings** and set the UPI ID and/or upload the QR.
Until then users see "Deposits aren't set up yet". Nothing payment-related is hardcoded.

Uploads are stored privately in `data/uploads/` (not `/public`) and served only via authorised API routes. For production,
swap `src/server/lib/uploads.ts` for S3/R2/Cloudinary. The Razorpay routes (`/api/wallet/deposit*`, webhook) are untouched.



git add .
git commit -m "Describe your changes"
git push origin main