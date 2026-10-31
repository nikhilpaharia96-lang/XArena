# XArena Originals (in-house games)

Dice, Coin Flip, Mines and Crash, built into XArena. They use the **same wallet and
`Transaction` ledger** as the rest of the app. No second wallet, no external provider.

## Money rules (same as the AS Tech seamless wallet)
- Stake is taken from **bonus → deposit → winning**. `lockedBalance` is never touched.
- On a win, the stake part of the payout returns to the buckets it came from;
  **only profit** goes to `winningBalance` (withdrawable). Bonus money cannot be turned into cash by playing.
- Every bet and settlement runs in one `BEGIN IMMEDIATE` transaction. Double-click/retry is
  protected by a per-player `requestId` (unique index) so a replay never charges twice.
- One open round per player per game (unique index). Admin can void an open round (exact refund).

## Fairness
Result = `HMAC_SHA256(serverSeed, "clientSeed:nonce:cursor")`. Players see the SHA-256 hash of the
server seed before betting, can set their own client seed, and get the old server seed revealed when
they rotate, so past rounds can be re-derived. Hidden state (mine layout, crash point) never leaves
the server while a round is open. Crash is settled by **server time**, not by the browser.

## Safety limits (Admin → XArena Originals)
Every game ships **switched off**. Per game: house edge (0.5%–15%), min bet, max bet, and
**max payout per round** (the most one round can ever cost you). Start small, e.g. max bet ₹1,000, max payout ₹20,000.

## Honest risks
- Short-term results are random: with few players the house can lose for a while. Keep max payout small versus your bankroll.
- Run a **single server instance** with a persistent disk (SQLite).
- Real-money games of chance are regulated in India and differ by state. Get legal advice before enabling them for the public.

## Where things are
- Engine & math: `src/server/games/` (tests in `__tests__`)
- Player API: `/api/originals/*` · Admin API: `/api/admin/originals/*`
- Player UI: `/originals` · Admin UI: `/admin/originals`
