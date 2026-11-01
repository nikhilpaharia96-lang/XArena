"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { formatPaiseExact } from "@/lib/format";
import { useWallet } from "@/hooks/use-wallet";
import { useOriginals, type GameKey } from "@/hooks/use-originals";
import { DiceGame } from "@/components/originals/dice-game";
import { CoinGame } from "@/components/originals/coin-game";
import { MinesGame } from "@/components/originals/mines-game";
import { SlotGame } from "@/components/originals/slot/slot-game";
import { CoinsGame } from "@/components/originals/coins/coins-game";
import { CrashGame } from "@/components/originals/crash-game";
import { FairnessPanel } from "@/components/originals/fairness-panel";
import { HistoryList } from "@/components/originals/history-list";

const TITLES: Record<GameKey, string> = { DICE: "Dice", COINFLIP: "Coin Flip", MINES: "Mines", CRASH: "Crash", SLOT: "Garuda Ascent", COINS: "Lakshmi Coins" };

export default function OriginalsPage() {
  const { data, isLoading } = useOriginals();
  const { data: wallet } = useWallet();
  const [selected, setSelected] = useState<GameKey | null>(null);

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
  const games = data?.games ?? [];
  if (games.length === 0) return <EmptyState icon={Dices} title="XArena Originals are not available right now" />;

  const current = games.find((g) => g.gameKey === selected) ?? games[0];
  const balance = wallet ? wallet.depositBalance + wallet.winningBalance + wallet.bonusBalance : 0; // spendable only (locked excluded)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white flex items-center gap-2"><Dices className="h-5 w-5 text-violet" /> XArena Originals</h1>
        <span className="text-sm font-bold text-white">{formatPaiseExact(balance)}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {games.map((g) => (
          <button
            key={g.gameKey}
            type="button"
            onClick={() => setSelected(g.gameKey)}
            className={cn("h-10 px-4 rounded-xl text-sm font-bold border whitespace-nowrap", current.gameKey === g.gameKey ? "gradient-brand text-white border-transparent" : "bg-surface-2 text-white/60 border-white/10")}
          >
            {TITLES[g.gameKey]}
          </button>
        ))}
      </div>
      {/* key forces a clean state when switching games */}
      {current.gameKey === "DICE" && <DiceGame key="d" cfg={current} balance={balance} />}
      {current.gameKey === "COINFLIP" && <CoinGame key="c" cfg={current} balance={balance} />}
      {current.gameKey === "MINES" && <MinesGame key="m" cfg={current} balance={balance} />}
      {current.gameKey === "SLOT" && <SlotGame key="s" cfg={current} balance={balance} />}
      {current.gameKey === "COINS" && <CoinsGame key="l" cfg={current} balance={balance} />}
      {current.gameKey === "CRASH" && <CrashGame key="x" cfg={current} balance={balance} />}
      <p className="text-[11px] text-white/40 text-center">
        House edge {(current.houseEdgeBps / 100).toFixed(1)}% · Max payout {formatPaiseExact(current.maxPayout)} · Play responsibly. 18+ only.
      </p>
      <HistoryList />
      <FairnessPanel />
    </div>
  );
}
