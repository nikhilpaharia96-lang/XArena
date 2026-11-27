"use client";
import { useState } from "react";
import { Gift, Plus, Trash2 } from "lucide-react";
import { useAdminBonusOffers, useDeleteBonusOffer, useSaveBonusOffer, type AdminBonusOffer, type AdminBonusOfferInput } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";

const num = (v: string) => (v === "" ? 0 : Number(v.replace(/\D/g, "")));

function Num({ label, value, onChange, suffix }: { label: string; value: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/60 mb-1.5 block">{label}{suffix ? ` (${suffix})` : ""}</label>
      <Input inputMode="numeric" value={String(value)} onChange={(e) => onChange(num(e.target.value))} aria-label={label} />
    </div>
  );
}

function OfferForm({ offer, onDone }: { offer?: AdminBonusOffer; onDone: () => void }) {
  const save = useSaveBonusOffer();
  const del = useDeleteBonusOffer();
  const [f, setF] = useState<AdminBonusOfferInput>({
    title: offer?.title ?? "", bonusPercent: offer?.bonusPercent ?? 10, rollingX: offer?.rollingX ?? 15,
    maxBonusRupees: (offer?.maxBonus ?? 100000) / 100, minDepositRupees: (offer?.minDeposit ?? 10000) / 100,
    validDays: offer?.validDays ?? 3, active: offer ? !!offer.active : true, sortOrder: offer?.sortOrder ?? 10,
  });
  const set = <K extends keyof AdminBonusOfferInput>(k: K, v: AdminBonusOfferInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = (e: unknown) => toast({ title: "Couldn't save", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" });

  return (
    <Card className="p-4 space-y-3">
      <div>
        <label className="text-xs font-semibold text-white/60 mb-1.5 block">Title</label>
        <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Mega Bonus" aria-label="Title" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Num label="Bonus" suffix="%" value={f.bonusPercent} onChange={(n) => set("bonusPercent", n)} />
        <Num label="Rolling" suffix="x, 0 = instant" value={f.rollingX} onChange={(n) => set("rollingX", n)} />
        <Num label="Max bonus" suffix="₹" value={f.maxBonusRupees} onChange={(n) => set("maxBonusRupees", n)} />
        <Num label="Min deposit" suffix="₹" value={f.minDepositRupees} onChange={(n) => set("minDepositRupees", n)} />
        <Num label="Valid for" suffix="days" value={f.validDays} onChange={(n) => set("validDays", n)} />
        <Num label="Order" value={f.sortOrder} onChange={(n) => set("sortOrder", n)} />
      </div>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 h-12 cursor-pointer">
        <span className="text-sm text-white">Shown to players</span>
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-5 w-5 accent-blue-600" />
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" loading={save.isPending} onClick={() => save.mutate({ id: offer?.id, input: f }, { onSuccess: () => { toast({ title: "Offer saved", tone: "success" }); onDone(); }, onError: err })}>
          {offer ? "Save" : "Create offer"}
        </Button>
        <Button variant="secondary" onClick={onDone}>Cancel</Button>
        {offer && (
          <Button variant="secondary" aria-label="Delete offer" loading={del.isPending} onClick={() => { if (confirm(`Delete "${offer.title}"?`)) del.mutate(offer.id, { onSuccess: onDone, onError: err }); }}>
            <Trash2 className="h-4 w-4 text-crimson" />
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function AdminBonusOffersPage() {
  const { data, isLoading, isError, refetch } = useAdminBonusOffers();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Deposit Bonus Offers</h1>
        <Button size="sm" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> New offer</Button>
      </div>
      <p className="text-xs text-white/55">
        Players pick one on the deposit page. The bonus is credited when you approve the deposit, and unlocks for withdrawal after they play
        bonus × rolling. Changes only affect new deposits — bonuses already given keep their terms.
      </p>
      {editing === "new" && <OfferForm onDone={() => setEditing(null)} />}
      {data.map((o) =>
        editing === o.id ? (
          <OfferForm key={o.id} offer={o} onDone={() => setEditing(null)} />
        ) : (
          <Card key={o.id} className="p-4">
            <button className="w-full text-left" onClick={() => setEditing(o.id)}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white flex items-center gap-1.5"><Gift className="h-4 w-4 text-gold" /> {o.title}</p>
                <span className={`text-[11px] font-bold ${o.active ? "text-signal" : "text-white/40"}`}>{o.active ? "LIVE" : "HIDDEN"}</span>
              </div>
              <p className="mt-1.5 text-xs text-white/65">
                {o.bonusPercent}% · {o.rollingX}x rolling · max ₹{(o.maxBonus / 100).toLocaleString("en-IN")} · min deposit ₹{o.minDeposit / 100} ·{" "}
                {o.validDays ? `${o.validDays} days` : "no expiry"}
              </p>
            </button>
          </Card>
        )
      )}
    </div>
  );
}
