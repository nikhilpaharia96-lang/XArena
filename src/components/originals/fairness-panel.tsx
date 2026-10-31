"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast-store";
import { originals, toastError, useFairness } from "@/hooks/use-originals";

export function FairnessPanel() {
  const { data } = useFairness();
  const qc = useQueryClient();
  const [seed, setSeed] = useState("");
  const [busy, setBusy] = useState(false);

  const rotate = async () => {
    setBusy(true);
    try {
      await originals.rotate(seed.trim() || undefined);
      setSeed("");
      toast({ title: "Seeds rotated", description: "Your previous server seed is now revealed below.", tone: "success" });
      qc.invalidateQueries({ queryKey: ["originals-fair"] });
      qc.invalidateQueries({ queryKey: ["originals"] });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-black text-white flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-signal" /> Provably fair
      </h3>
      <p className="text-xs text-white/50">
        Each result is derived from a server seed (shown here only as a hash until you rotate), your client seed and a bet counter. Rotate to reveal the old server seed and verify past rounds yourself.
      </p>
      {data && (
        <dl className="text-xs space-y-1.5 break-all">
          <div><dt className="text-white/40">Server seed hash</dt><dd className="text-white font-mono">{data.current.serverSeedHash}</dd></div>
          <div><dt className="text-white/40">Client seed</dt><dd className="text-white font-mono">{data.current.clientSeed}</dd></div>
          <div><dt className="text-white/40">Next bet number</dt><dd className="text-white font-mono">{data.current.nonce}</dd></div>
        </dl>
      )}
      <div className="flex gap-2">
        <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="New client seed (optional)" maxLength={64} />
        <Button variant="secondary" loading={busy} onClick={rotate}>Rotate</Button>
      </div>
      {data && data.revealed.length > 0 && (
        <div className="pt-2 space-y-2">
          <p className="text-xs font-semibold text-white/60">Revealed seeds</p>
          {data.revealed.slice(0, 5).map((r) => (
            <div key={r.serverSeedHash} className="rounded-lg bg-surface-2 p-2 text-[11px] font-mono break-all text-white/70">
              <div>server: {r.serverSeed}</div>
              <div>hash: {r.serverSeedHash}</div>
              <div>client: {r.clientSeed} · bets: {r.roundsPlayed}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
