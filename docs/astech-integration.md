# AS Tech game-provider integration

XArena integrates AS Tech as a **seamless-wallet** provider. XArena's own
`Wallet` / `Transaction` tables stay the single source of truth for balances;
AS Tech reads and changes them only through the signed callback.

Reference: https://astechapi.cloud/docs

```
Browser ──► XArena API ──► astech.service ──► astech.client ──► AS Tech API
                 ▲                                                   │
                 └──── /api/providers/astech/callback (HMAC) ◄───────┘
```

## 1. Setup checklist

1. In the AS Tech partner panel → **API Details**, copy the **API key** and **secret key**.
2. Set server env vars (see `.env.example`): `ASTECH_API_KEY`, `ASTECH_SECRET_KEY`,
   `ASTECH_API_BASE_URL`, and **`APP_PUBLIC_URL`** (your `https://` site origin).
3. In the same panel set all three — without them every call returns `403`:
   - **Server IP** — your production server's outbound IP (one IP).
   - **Domain** — the same domain as `APP_PUBLIC_URL`. AS Tech checks the `Origin`
     header; XArena's client sends it automatically.
   - **Callback URL** — `https://<your-domain>/api/providers/astech/callback`
     (shown, copyable, in **Admin → Game Provider**). Must be public HTTPS.
4. Open **Admin → Game Provider**, click **Test connection**, then **Sync games**.
5. Launch a game. AS Tech calls `getBalance` on the callback *before* the game opens;
   if the callback is unreachable the launch fails with `502`.

## 2. Wallet rules (important)

| Event | What XArena does |
|---|---|
| `getBalance` | Returns deposit + winning + bonus (not `lockedBalance`) as a 2-decimal string. |
| `writeBet` | **One atomic transaction** per finished round (`bet`, `win`, `round_finished`). |
| `rollback` | Exact inverse of the original, bucket by bucket. Unknown id → success + current balance. |

* Bets debit **bonus → deposit → winning** (identical to tournament entry).
* Withdrawals are paid only from `winningBalance`, and deposit money is play-only. To keep
  that rule intact, the **stake part of a win returns to the buckets the bet came from**,
  and **only profit (win − bet) is credited to `winningBalance`**. A break-even round
  therefore cannot launder deposit money into withdrawable winnings. The player's total
  always equals the provider's `balance − bet + win`.
* Ledger rows use the existing `Transaction` table with types `GAME_BET`, `GAME_WIN`,
  `GAME_ROLLBACK`, `GAME_WIN_REVERSAL` and unique `referenceId`s (`ASTECH-<tx>-BET|WIN|RBK|RBW`).
* Wallet change + `ProviderTransaction` + `ProviderCallbackLog` commit in **one SQLite
  transaction** (`BEGIN IMMEDIATE`). `UNIQUE(provider, providerTransactionId)` is the hard
  idempotency backstop. A repeated `transaction_id` returns the stored balance.
* Only **INR** is accepted (XArena's wallet is INR-only integer paise). Other currencies get
  `UNSUPPORTED_CURRENCY`. Games without INR in their catalogue entry are never shown or launchable.
* If a player already spent a win that is later rolled back, no bucket goes negative; the
  shortfall is recorded (`unrecovered` in the callback log) for manual reconciliation.

## 3. Security

* Secrets are read only in server code; nothing is `NEXT_PUBLIC_*`; the browser never calls AS Tech.
* Callback HMAC is verified over the **raw body** (constant-time) before any parsing.
* Launch URLs are single-use: never cached, never stored, fresh `/session/open` on every click.
* The client can't choose provider game ids or player identity; both are resolved server-side.
  `player_login` is `xa_<User.uid>` (opaque, not the DB primary key).
* Logs are structured JSON with credentials/signatures redacted.
* Rate limiting: launch 10/min/user, admin test/sync limited, provider calls capped at 110/min
  (AS Tech default is 120/min/key), catalogue cached and refreshed in the background (single-flight).

## 4. Errors & retries

`429` and `503` are retried with exponential backoff (max 4 attempts). `400/401/403/404/409/502`
are never retried. The `x-request-id` of every AS Tech response is stored in `ProviderRequestLog`
and `ProviderGameSession` — quote it to AS Tech support.

## 5. Tests

`npm test` — signature vectors, client retry/auth rules, catalogue parsing/sync, launch rules,
wallet accounting/idempotency/atomicity (including two-connection races) and the full callback
pipeline. All AS Tech traffic is mocked; no credentials are needed.

## 6. Production deployment notes

* **Database**: the runtime DB is SQLite (`data/xarena.db`) with `prisma/schema.prisma` as the
  Postgres target; both contain the five `Provider*` tables. When moving to Postgres, keep
  the unique constraint on `(provider, providerTransactionId)` and run wallet updates in
  `SERIALIZABLE` transactions or `SELECT … FOR UPDATE` on the wallet row — the in-process
  `BEGIN IMMEDIATE` guarantee is SQLite-specific.
* Run a **single** app instance per SQLite file, or move to Postgres before scaling out.
* AS Tech must reach the callback within 3 s; keep it on the same region as the DB.
* `ProviderCallbackLog` grows with every `getBalance`; add a retention job (e.g. 30 days).
