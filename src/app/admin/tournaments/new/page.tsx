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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slugEdited, setSlugEdited] = useState(false);

  const slugify = (v: string) =>
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const update = (key: string, value: unknown) => {
    setForm((f) => ({ ...f, [key]: value }));
    // clear the error of the field being edited
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const onTitleChange = (v: string) => {
    update("title", v);
    if (!slugEdited) update("slug", slugify(v));
  };

  const validate = (isFreeFire: boolean) => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = "Title must be at least 3 characters";
    if (!form.slug) e.slug = "Slug is required";
    else if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = "Only lowercase letters, numbers and hyphens";
    if (form.description.trim().length < 10) e.description = "Description must be at least 10 characters";
    if (!form.gameId) e.gameId = "Select a game";
    if (isFreeFire && !form.category) e.category = "Select a Free Fire category";
    if (form.format === "PAID" && form.entryFeeRupees <= 0) e.entryFeeRupees = "Paid tournaments need an entry fee above ₹0";
    if (!Number.isInteger(form.entryFeeRupees) || form.entryFeeRupees < 0) e.entryFeeRupees = "Enter a whole number (₹)";
    if (!Number.isInteger(form.maxSlots) || form.maxSlots < 2 || form.maxSlots > 1000) e.maxSlots = "Between 2 and 1000";
    if (!Number.isInteger(form.roomSize) || form.roomSize < 1 || form.roomSize > 64) e.roomSize = "Between 1 and 64";
    else if (form.roomSize > form.maxSlots) e.roomSize = "Can't be larger than max slots";
    if (!Number.isInteger(form.prizePoolRupees) || form.prizePoolRupees < 0) e.prizePoolRupees = "Enter a whole number (₹)";
    const prizeSum = firstPrize + secondPrize + thirdPrize;
    if (prizeSum > form.prizePoolRupees) e.prizes = `Prizes add up to ₹${prizeSum}, which is more than the ₹${form.prizePoolRupees} pool`;
    if (form.prizePoolRupees > 0 && firstPrize <= 0) e.prizes = e.prizes ?? "Set the 1st prize (prize pool is above ₹0)";
    if (form.rules.trim().length < 10) e.rules = "Rules must be at least 10 characters";
    const rs = new Date(form.registrationStartsAt).getTime();
    const re = new Date(form.registrationEndsAt).getTime();
    const ms = new Date(form.matchStartsAt).getTime();
    if (!form.registrationStartsAt) e.registrationStartsAt = "Required";
    if (!form.registrationEndsAt) e.registrationEndsAt = "Required";
    else if (rs && re <= rs) e.registrationEndsAt = "Must be after registration starts";
    if (!form.matchStartsAt) e.matchStartsAt = "Required";
    else if (re && ms < re) e.matchStartsAt = "Must be on/after registration ends";
    return e;
  };

  const handleSubmit = () => {
    const isFreeFire = games?.find((g) => g.id === form.gameId)?.slug === FREE_FIRE_GAME_SLUG;
    const found = validate(isFreeFire);
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      toast({ title: "Fix the highlighted fields", description: found[keys[0]], tone: "error" });
      document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        entryFeeRupees: form.format === "FREE" ? 0 : form.entryFeeRupees,
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
        <Field label="Title" error={errors.title}><Input value={form.title} className={errors.title ? "border-crimson/60" : undefined} onChange={(e) => onTitleChange(e.target.value)} /></Field>
        <Field label="Slug (auto-generated from title)" error={errors.slug}><Input value={form.slug} className={errors.slug ? "border-crimson/60" : undefined} onChange={(e) => { setSlugEdited(true); update("slug", e.target.value.toLowerCase()); }} placeholder="free-fire-mega-friday" /></Field>
        <Field label="Description (min 10 characters)" error={errors.description} count={form.description.trim().length} min={10}>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className={`w-full rounded-xl bg-surface-2 border px-4 py-3 text-sm text-white outline-none focus:border-violet/60 ${errors.description ? "border-crimson/60" : "border-white/10"}`}
          />
        </Field>

        <Field label="Game" error={errors.gameId}>
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
          <Field label="Category (decides where it appears on the Free Fire page)" error={errors.category}>
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
          <Field label="Entry Fee (₹)" error={errors.entryFeeRupees}><Input type="number" min={0} disabled={form.format === "FREE"} value={form.format === "FREE" ? 0 : form.entryFeeRupees} className={errors.entryFeeRupees ? "border-crimson/60" : undefined} onChange={(e) => update("entryFeeRupees", Number(e.target.value))} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max Slots" error={errors.maxSlots}><Input type="number" min={2} value={form.maxSlots} className={errors.maxSlots ? "border-crimson/60" : undefined} onChange={(e) => update("maxSlots", Number(e.target.value))} /></Field>
          <Field label="Room Size" error={errors.roomSize}><Input type="number" min={1} value={form.roomSize} className={errors.roomSize ? "border-crimson/60" : undefined} onChange={(e) => update("roomSize", Number(e.target.value))} /></Field>
        </div>

        <Field label="Map (optional)"><Input value={form.map} onChange={(e) => update("map", e.target.value)} /></Field>

        <Field label="Prize Pool (₹ total)" error={errors.prizePoolRupees}><Input type="number" min={0} value={form.prizePoolRupees} className={errors.prizePoolRupees ? "border-crimson/60" : undefined} onChange={(e) => update("prizePoolRupees", Number(e.target.value))} /></Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="1st Prize (₹)"><Input type="number" min={0} value={firstPrize} onChange={(e) => { setFirstPrize(Number(e.target.value)); setErrors((x) => ({ ...x, prizes: "" })); }} /></Field>
          <Field label="2nd Prize (₹)"><Input type="number" min={0} value={secondPrize} onChange={(e) => { setSecondPrize(Number(e.target.value)); setErrors((x) => ({ ...x, prizes: "" })); }} /></Field>
          <Field label="3rd Prize (₹)"><Input type="number" min={0} value={thirdPrize} onChange={(e) => { setThirdPrize(Number(e.target.value)); setErrors((x) => ({ ...x, prizes: "" })); }} /></Field>
        </div>

        {errors.prizes && <p data-field-error className="-mt-2 text-xs text-crimson">{errors.prizes}</p>}

        <Field label="Rules (min 10 characters)" error={errors.rules} count={form.rules.trim().length} min={10}>
          <textarea
            value={form.rules}
            onChange={(e) => update("rules", e.target.value)}
            rows={3}
            className={`w-full rounded-xl bg-surface-2 border px-4 py-3 text-sm text-white outline-none focus:border-violet/60 ${errors.rules ? "border-crimson/60" : "border-white/10"}`}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Registration Starts" error={errors.registrationStartsAt}><Input type="datetime-local" value={form.registrationStartsAt} onChange={(e) => update("registrationStartsAt", e.target.value)} /></Field>
          <Field label="Registration Ends" error={errors.registrationEndsAt}><Input type="datetime-local" value={form.registrationEndsAt} onChange={(e) => update("registrationEndsAt", e.target.value)} /></Field>
          <Field label="Match Starts" error={errors.matchStartsAt}><Input type="datetime-local" value={form.matchStartsAt} onChange={(e) => update("matchStartsAt", e.target.value)} /></Field>
        </div>

        <Button fullWidth size="lg" loading={createTournament.isPending} onClick={handleSubmit}>
          Create Tournament (as Draft)
        </Button>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  count,
  min,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  count?: number;
  min?: number;
}) {
  return (
    <div data-field-error={error ? "" : undefined}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-white/60 block">{label}</label>
        {count !== undefined && min !== undefined && (
          <span className={`text-[11px] font-mono ${count >= min ? "text-signal" : "text-white/35"}`}>
            {count}/{min}
          </span>
        )}
      </div>
      {children}
      {error && <p className="mt-1.5 text-xs text-crimson">{error}</p>}
    </div>
  );
}
