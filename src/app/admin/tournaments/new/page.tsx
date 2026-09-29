"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGames } from "@/hooks/use-tournaments";
import { useCreateTournament } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { FREE_FIRE_CATEGORIES, FREE_FIRE_GAME_SLUG } from "@/lib/free-fire-categories";

const MODES = ["SOLO", "DUO", "SQUAD", "ONE_V_ONE", "TWO_V_TWO", "FOUR_V_FOUR", "CLASSIC", "CLASH_SQUAD", "CUSTOM"];

export default function NewTournamentPage() {
  const router = useRouter();
  const { data: games } = useGames();
  const createTournament = useCreateTournament();

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    gameId: "",
    mode: "SOLO",
    format: "PAID" as "PAID" | "FREE",
    entryFeeRupees: 0,
    prizePoolRupees: 0,
    maxSlots: 48,
    roomSize: 1,
    map: "",
    category: "",
    rules: "",
    registrationStartsAt: "",
    registrationEndsAt: "",
    matchStartsAt: "",
  });
  const [firstPrize, setFirstPrize] = useState(0);
  const [secondPrize, setSecondPrize] = useState(0);
  const [thirdPrize, setThirdPrize] = useState(0);

  const update = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.title || !form.slug || !form.gameId || !form.registrationStartsAt || !form.registrationEndsAt || !form.matchStartsAt) {
      toast({ title: "Please fill in all required fields", tone: "error" });
      return;
    }

    const isFreeFire = games?.find((g) => g.id === form.gameId)?.slug === FREE_FIRE_GAME_SLUG;
    if (isFreeFire && !form.category) {
      toast({ title: "Select a Free Fire category", tone: "error" });
      return;
    }

    const prizeDistribution = [
      { position: 1, amountRupees: firstPrize },
      ...(secondPrize > 0 ? [{ position: 2, amountRupees: secondPrize }] : []),
      ...(thirdPrize > 0 ? [{ position: 3, amountRupees: thirdPrize }] : []),
    ];

    createTournament.mutate(
      {
        ...form,
        category: isFreeFire ? form.category : null,
        registrationStartsAt: new Date(form.registrationStartsAt).toISOString(),
        registrationEndsAt: new Date(form.registrationEndsAt).toISOString(),
        matchStartsAt: new Date(form.matchStartsAt).toISOString(),
        prizeDistribution,
      },
      {
        onSuccess: () => {
          toast({ title: "Tournament created as draft", tone: "success" });
          router.push("/admin/tournaments");
        },
        onError: (err) => {
          toast({ title: "Failed to create", description: err instanceof ApiClientError ? err.message : "Try again", tone: "error" });
        },
      }
    );
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/admin/tournaments" className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back to Tournaments
      </Link>
      <h1 className="text-2xl font-black text-white">Create Tournament</h1>

      <Card className="p-5 space-y-4">
        <Field label="Title"><Input value={form.title} onChange={(e) => update("title", e.target.value)} /></Field>
        <Field label="Slug (URL-friendly)"><Input value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="free-fire-mega-friday" /></Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet/60"
          />
        </Field>

        <Field label="Game">
          <select
            value={form.gameId}
            onChange={(e) => update("gameId", e.target.value)}
            className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white outline-none focus:border-violet/60"
          >
            <option value="">Select a game</option>
            {games?.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </Field>

        {games?.find((g) => g.id === form.gameId)?.slug === FREE_FIRE_GAME_SLUG && (
          <Field label="Category (decides where it appears on the Free Fire page)">
            <select value={form.category} onChange={(e) => update("category", e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white outline-none">
              <option value="">Select a category</option>
              {FREE_FIRE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Mode">
          <select value={form.mode} onChange={(e) => update("mode", e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white outline-none">
            {MODES.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Format">
            <select value={form.format} onChange={(e) => update("format", e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white outline-none">
              <option value="PAID">Paid</option>
              <option value="FREE">Free</option>
            </select>
          </Field>
          <Field label="Entry Fee (₹)"><Input type="number" value={form.entryFeeRupees} onChange={(e) => update("entryFeeRupees", Number(e.target.value))} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max Slots"><Input type="number" value={form.maxSlots} onChange={(e) => update("maxSlots", Number(e.target.value))} /></Field>
          <Field label="Room Size"><Input type="number" value={form.roomSize} onChange={(e) => update("roomSize", Number(e.target.value))} /></Field>
        </div>

        <Field label="Map (optional)"><Input value={form.map} onChange={(e) => update("map", e.target.value)} /></Field>

        <Field label="Prize Pool (₹ total)"><Input type="number" value={form.prizePoolRupees} onChange={(e) => update("prizePoolRupees", Number(e.target.value))} /></Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="1st Prize (₹)"><Input type="number" value={firstPrize} onChange={(e) => setFirstPrize(Number(e.target.value))} /></Field>
          <Field label="2nd Prize (₹)"><Input type="number" value={secondPrize} onChange={(e) => setSecondPrize(Number(e.target.value))} /></Field>
          <Field label="3rd Prize (₹)"><Input type="number" value={thirdPrize} onChange={(e) => setThirdPrize(Number(e.target.value))} /></Field>
        </div>

        <Field label="Rules">
          <textarea
            value={form.rules}
            onChange={(e) => update("rules", e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet/60"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Registration Starts"><Input type="datetime-local" value={form.registrationStartsAt} onChange={(e) => update("registrationStartsAt", e.target.value)} /></Field>
          <Field label="Registration Ends"><Input type="datetime-local" value={form.registrationEndsAt} onChange={(e) => update("registrationEndsAt", e.target.value)} /></Field>
          <Field label="Match Starts"><Input type="datetime-local" value={form.matchStartsAt} onChange={(e) => update("matchStartsAt", e.target.value)} /></Field>
        </div>

        <Button fullWidth size="lg" loading={createTournament.isPending} onClick={handleSubmit}>
          Create Tournament (as Draft)
        </Button>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/60 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
