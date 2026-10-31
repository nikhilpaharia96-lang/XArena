"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BetInput, rupeesToPaise } from "./bet-input";
import { ResultBanner } from "./result-banner";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { crashMultiplierAt } from "@/server/games/math";
import { newRequestId, originals, toastError, useRefreshMoney, type OriginalGame, type Round } from "@/hooks/use-originals";

interface Live {
  startedAtMs: number;
  serverNowMs: number;
  autoCashoutBps: number | null;
  capMultiplierBps: number;
}

export function CrashGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const [bet, setBet] = useState("10");
  const [auto, setAuto] = useState("");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [mult, setMult] = useState(10_000);
  const offset = useRef(0); // serverNow - clientNow, so the local clock can't skew the display
  const refresh = useRefreshMoney();

  const active = round?.status === "ACTIVE";
  const live = (active ? round?.live : null) as Live | null;
  const stake = rupeesToPaise(bet);
  const autoBps = auto ? Math.round(Number(auto) * 10_000) : undefined;

  const adopt = (r: Round | null) => {
    setRound(r);
    if (r?.live) offset.current = (r.live as unknown as Live).serverNowMs - Date.now();
    if (r && r.status !== "ACTIVE") {
      refresh();
      setMult(r.status === "WON" ? r.multiplierBps : Number(r.result?.crashBps ?? 10_000));
    }
  };

  // Resume after refresh.
  useEffect(() => {
    originals.crashState().then((r) => adopt(r.round)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate locally; ask the server for the truth about twice a second.
  useEffect(() => {
    if (!live) return;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() + offset.current - live.startedAtMs;
      setMult(Math.min(crashMultiplierAt(elapsed), live.autoCashoutBps ?? Infinity, live.capMultiplierBps));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const poll = setInterval(() => {
      originals.crashState().then((r) => {
        if (!r.round) return;
        if (r.round.status !== "ACTIVE") adopt(r.round);
      }).catch(() => undefined);
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.startedAtMs]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      adopt(await originals.crashStart({ bet: stake, autoCashoutBps: autoBps, requestId: newRequestId() }));
      refresh(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const cashout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      adopt(await originals.crashCashout());
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const crashed = round?.status === "LOST";
  const autoInvalid = auto !== "" && (!Number.isFinite(Number(auto)) || Number(auto) < 1.01 || Number(auto) > 1000);

  return (
    <Card className="p-5 space-y-4">
      <div className="h-36 rounded-xl bg-surface-2 border border-white/10 flex flex-col items-center justify-center">
        <span className={cn("text-5xl font-black tabular-nums", crashed ? "text-crimson" : round?.status === "WON" ? "text-signal" : "text-white")}>
          {(mult / 10_000).toFixed(2)}×
        </span>
        <span className="text-xs text-white/40 mt-1">{crashed ? "Crashed" : active ? "Cash out before it crashes" : round?.status === "WON" ? "Cashed out" : "Place a bet to start"}</span>
      </div>

      {active ? (
        <Button fullWidth size="lg" variant="cta" loading={busy} onClick={cashout}>
          Cash out {formatPaiseExact(Math.floor((round!.bet * mult) / 10_000))}
        </Button>
      ) : (
        <>
          <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={busy} />
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Auto cash-out at (optional, e.g. 2.00)</label>
            <Input inputMode="decimal" value={auto} onChange={(e) => setAuto(e.target.value.replace(/[^0-9.]/g, ""))} error={autoInvalid ? "Use a value between 1.01 and 1000" : undefined} />
          </div>
          <Button fullWidth size="lg" variant="cta" loading={busy} disabled={stake < cfg.minBet || stake > cfg.maxBet || autoInvalid} onClick={start}>
            Place bet
          </Button>
        </>
      )}
      <ResultBanner round={round} />
    </Card>
  );
}
