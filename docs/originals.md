# XArena Originals (in-house games)

Dice, Coin Flip, Mines, Crash and the **Garuda Ascent** and **Lakshmi Coins** slots, built into XArena. They use the **same wallet and
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

## Garuda Ascent (slot)
Original 5x3 slot, 10 fixed lines, wild sun disc (reels 2-4), temple scatter. 3/4/5 scatters = 8/12/16 free spins;
every winning free spin raises the "Ascent" multiplier x1 to x5. The whole feature is decided server-side inside ONE bet
(one debit, one settlement), so a browser refresh can never lose or duplicate a feature.
- Measured return: **94.73% RTP** over 8M simulated rounds (tests re-check it stays within +/-1.5%). Hit rate about 37%, free spins about 1 in 80.
- Admin "house edge" for SLOT scales every payout around that baseline: default 5.3% (= 94.7% RTP). Raising it lowers RTP.
- **Demo mode** (`POST /api/originals/slot/demo`) uses the same maths with virtual credits, no wallet and no database writes.
- Max payout per round clamps the total including free spins.
- Art is original SVG/CSS (no licensed or copied game assets). Sounds are synthesised in the browser.

## Lakshmi Coins (slot)
Original 5x3 slot with **243 ways to win** and a **Coin Respin** bonus: 6+ Cash Coins lock with cash values (some are
MINI / MINOR prizes), 3 respins that reset on every new coin, and a grand bonus if all 15 cells fill. The whole bonus is decided
server-side inside ONE bet. Measured **93.95% RTP** (10M simulated rounds, +/-0.5%); bonus triggers about 1 in 240 spins.
Admin edge default 6.05% is neutral; raising it lowers every payout proportionally. Demo mode (`/coins/demo`) writes nothing.

## Where things are
- Engine & math: `src/server/games/` (tests in `__tests__`); slot maths `slot-math.ts`; slot UI `src/components/originals/slot/`
- Player API: `/api/originals/*` · Admin API: `/api/admin/originals/*`
- Player UI: `/originals` · Admin UI: `/admin/originals`
