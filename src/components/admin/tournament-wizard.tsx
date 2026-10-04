"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, KeyRound, Plus, Rocket, Save, Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { api, ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { useGames } from "@/hooks/use-tournaments";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { gameModeLabel, formatDateTimeFull } from "@/lib/format";
import { FREE_FIRE_CATEGORIES, FREE_FIRE_GAME_SLUG } from "@/lib/free-fire-categories";
import { ImageInput } from "./image-input";
import { TournamentPreview } from "./tournament-preview";
import {
  ALL_MODES, CUSTOM_CATEGORY_VALUES, FF_MAPS, MODE_TEAM_SIZE, STEPS, STEP_OF_FIELD, buildPayload, emptyForm, localInputToIso,
  ordinal, slugify, validateDraft, validateFull, type StepId, type TournamentForm,
} from "./tournament-form-model";

const inputCls = (err?: string) =>
  cn(
    "w-full rounded-xl bg-surface-2 border px-4 h-12 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-violet/60 focus:ring-2 focus:ring-violet/20 disabled:opacity-50",
    err ? "border-crimson/60" : "border-white/10"
  );
const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n || 0)}`;
const msg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

function Field({ id, label, error, hint, count, max, children }: {
  id: string; label: string; error?: string; hint?: string; count?: number; max?: number; children: React.ReactNode;
}) {
  return (
    <div data-error={error ? "" : undefined}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-semibold text-white/60">{label}</label>
        {count !== undefined && max !== undefined && (
          <span className={cn("font-mono text-[11px]", count > max ? "text-crimson" : "text-white/35")}>{count}/{max}</span>
        )}
      </div>
      {children}
      {hint && !error && <p className="mt-1.5 text-[11px] text-white/30">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-crimson">{error}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-black text-white">{title}</h2>
        {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export interface WizardProps {
  initial?: TournamentForm;
  tournamentId?: string;
  status?: string;          // existing tournament status (edit mode)
  slotsFilled?: number;     // existing joined players (edit mode)
}

export function TournamentWizard({ initial, tournamentId, status, slotsFilled = 0 }: WizardProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: games, isLoading: gamesLoading } = useGames();

  const editing = Boolean(tournamentId);
  const isPublished = editing && status !== "DRAFT";
  const locked = slotsFilled > 0; // money/format locked once players joined

  const [form, setForm] = useState<TournamentForm>(initial ?? emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<StepId>("basic");
  const [visited, setVisited] = useState<Set<StepId>>(new Set(["basic"]));
  const [slugEdited, setSlugEdited] = useState(editing);
  const [roomSizeTouched, setRoomSizeTouched] = useState(editing);
  const [saving, setSaving] = useState<null | "draft" | "create">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Only rendered inside the Schedule step (never in the SSR'd first step), so no hydration mismatch.
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const game = games?.find((g) => g.id === form.gameId);
  const isFF = game?.slug === FREE_FIRE_GAME_SLUG;
  const modes = game?.supportedModes?.length ? game.supportedModes : ALL_MODES;

  // Default to the first game once loaded (new tournaments only).
  useEffect(() => {
    if (!editing && games?.length && !form.gameId) set("gameId", games[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games]);

  function set<K extends keyof TournamentForm>(key: K, value: TournamentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: "" } : e));
  }

  const onTitle = (v: string) => {
    set("title", v);
    if (!slugEdited) set("slug", slugify(v));
  };

  const onGame = (id: string) => {
    const g = games?.find((x) => x.id === id);
    set("gameId", id);
    if (g?.slug !== FREE_FIRE_GAME_SLUG) set("category", null);
    if (g?.supportedModes?.length && !g.supportedModes.includes(form.mode)) set("mode", g.supportedModes[0]);
  };

  const onMode = (m: string) => {
    set("mode", m);
    if (!roomSizeTouched && MODE_TEAM_SIZE[m]) set("roomSize", MODE_TEAM_SIZE[m]);
  };

  // ---- derived -----------------------------------------------------------
  const distributed = form.prizes.reduce((n, p) => n + (p || 0), 0);
  const remaining = form.prizePool - distributed;

  const fullErrors = useMemo(() => validateFull(form, isFF), [form, isFF]);
  const stepState = (id: StepId) => {
    const keys = Object.keys(fullErrors).filter((k) => STEP_OF_FIELD[k] === id);
    return { complete: keys.length === 0 && (visited.has(id) || id === "room" || id === "advanced"), count: keys.length };
  };

  const cat = FREE_FIRE_CATEGORIES.find((c) => c.value === form.category);
  const previewStatus = editing ? (status ?? "DRAFT") : "DRAFT";

  // ---- persistence -------------------------------------------------------
  const goToFirstError = (errs: Record<string, string>) => {
    const keys = Object.keys(errs).filter((k) => errs[k]);
    if (!keys.length) return;
    const target = STEP_OF_FIELD[keys[0]] ?? "basic";
    setStep(target);
    setVisited((v) => new Set(v).add(target));
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector<HTMLElement>("[data-error] input, [data-error] textarea, [data-error] select")?.focus({ preventScroll: true });
    });
  };

  const persist = async (mode: "draft" | "create", publish: boolean) => {
    setSaving(mode);
    try {
      let id = tournamentId;
      if (editing) {
        // PATCH: slug is immutable; published tournaments are validated strictly server-side.
        await api.patch(`/api/admin/tournaments/${id}`, buildPayload(form, { draft: false, ffCategory: isFF, includeSlug: false }));
      } else {
        const res = await api.post<{ id: string }>(
          "/api/admin/tournaments",
          buildPayload(form, { draft: mode === "draft", ffCategory: isFF, includeSlug: true })
        );
        id = res.id;
      }

      if (publish && id) {
        try {
          await api.post(`/api/admin/tournaments/${id}/publish`);
          toast({ title: "Tournament published", tone: "success" });
        } catch (e) {
          toast({ title: "Saved as draft — couldn't publish", description: msg(e), tone: "error" });
          await qc.invalidateQueries({ queryKey: ["admin"] });
          router.replace(`/admin/tournaments/${id}/edit`);
          return;
        }
      } else {
        toast({ title: mode === "draft" ? "Draft saved" : editing ? "Changes saved" : "Tournament created", tone: "success" });
      }

      await qc.invalidateQueries({ queryKey: ["admin"] });
      if (mode === "draft" && !publish) {
        if (!editing) router.replace(`/admin/tournaments/${id}/edit`); // keep working on the new draft
      } else {
        router.push(`/admin/tournaments/${id}`);
      }
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "SLUG_TAKEN") {
        setErrors((x) => ({ ...x, slug: "This slug is already used — change it" }));
        setStep("basic");
      }
      toast({ title: mode === "draft" ? "Couldn't save draft" : "Couldn't create tournament", description: msg(e), tone: "error" });
    } finally {
      setSaving(null);
    }
  };

  const onSaveDraft = () => {
    const errs = validateDraft(form);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast({ title: "A draft needs a name and a game", description: Object.values(errs)[0], tone: "error" });
      return goToFirstError(errs);
    }
    void persist("draft", false);
  };

  const onCreate = () => {
    setVisited(new Set(STEPS.map((s) => s.id)));
    const errs = validateFull(form, isFF);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast({ title: "Complete the highlighted fields", description: `${Object.keys(errs).length} issue(s) to fix before ${isPublished ? "saving" : "creating"}.`, tone: "error" });
      return goToFirstError(errs);
    }
    if (isPublished) void persist("create", false); // already public: just save changes
    else setConfirmOpen(true);
  };

  // ---- navigation --------------------------------------------------------
  const idx = STEPS.findIndex((s) => s.id === step);
  const goStep = (id: StepId) => {
    setStep(id);
    setVisited((v) => new Set(v).add(id));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (gamesLoading && !editing) return <Skeleton className="h-[600px] rounded-3xl" />;

  const busy = saving !== null;

  return (
    <div className="space-y-5 pb-28 lg:pb-0" ref={topRef}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold">Tournament Operations</p>
          <h1 className="text-2xl font-black text-white">{editing ? "Edit Tournament" : "Create Tournament"}</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {editing ? "Update the details — changes apply to the existing tournament." : "Set up a new tournament with all details."}
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          {!isPublished && (
            <Button variant="secondary" onClick={onSaveDraft} loading={saving === "draft"} disabled={busy}>
              <Save className="h-4 w-4" /> Save as Draft
            </Button>
          )}
          <Button onClick={onCreate} loading={saving === "create"} disabled={busy}>
            <Rocket className="h-4 w-4" /> {isPublished ? "Save Changes" : editing ? "Publish Tournament" : "Create Tournament"}
          </Button>
        </div>
      </div>

      {locked && (
        <p role="status" className="rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-xs text-gold">
          {slotsFilled} player(s) have joined, so entry fee, format and lowering capacity below that number are locked.
        </p>
      )}

      {/* Step navigation */}
      <nav aria-label="Tournament setup steps" className="-mx-4 px-4 overflow-x-auto no-scrollbar">
        <ol className="flex gap-2 min-w-max">
          {STEPS.map((s, i) => {
            const st = stepState(s.id);
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goStep(s.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "h-11 rounded-2xl px-3.5 inline-flex items-center gap-2 text-xs font-semibold border transition-colors",
                    active ? "gradient-brand border-transparent text-white" : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                  )}
                >
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10px] font-black",
                    active ? "bg-white/20" : st.complete ? "bg-signal/20 text-signal" : st.count && visited.has(s.id) ? "bg-crimson/20 text-crimson" : "bg-white/10")}>
                    {st.complete && !active ? <Check className="h-3 w-3" /> : st.count && visited.has(s.id) && !active ? <AlertCircle className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={() => setPreviewOpen((o) => !o)}
        aria-expanded={previewOpen}
        className="lg:hidden w-full h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold text-white/70 inline-flex items-center justify-center gap-2"
      >
        <Eye className="h-4 w-4" /> {previewOpen ? "Hide" : "Show"} live preview
      </button>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="rounded-3xl border border-white/10 bg-surface/80 p-4 sm:p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {step === "basic" && (
                <Section title="Basic Information" subtitle="Name, game, category, description, rules and artwork.">
                  <Field id="t-title" label="Tournament Name *" error={errors.title} count={form.title.length} max={100}>
                    <input id="t-title" className={inputCls(errors.title)} value={form.title} maxLength={110} placeholder="e.g. Free Fire CS Scrims Night"
                      aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "t-title-err" : undefined} onChange={(e) => onTitle(e.target.value)} />
                  </Field>
                  <Field id="t-slug" label="URL slug" error={errors.slug} hint={editing ? "The slug can't be changed after creation." : "Auto-generated from the name. Must be unique."}>
                    <input id="t-slug" className={inputCls(errors.slug)} value={form.slug} disabled={editing}
                      onChange={(e) => { setSlugEdited(true); set("slug", e.target.value.toLowerCase()); }} />
                  </Field>
                  <Field id="t-game" label="Game *" error={errors.gameId}>
                    <select id="t-game" className={inputCls(errors.gameId)} value={form.gameId} onChange={(e) => onGame(e.target.value)}>
                      <option value="">Select a game</option>
                      {games?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </Field>
                  {isFF && (
                    <Field id="t-cat" label="Category *" error={errors.category} hint="Decides which Free Fire page the tournament appears on.">
                      <select id="t-cat" className={inputCls(errors.category)} value={form.category ?? ""} onChange={(e) => set("category", e.target.value || null)}>
                        <option value="">Select a category</option>
                        <optgroup label="Free Fire modes">
                          {FREE_FIRE_CATEGORIES.filter((c) => !CUSTOM_CATEGORY_VALUES.includes(c.value)).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </optgroup>
                        <optgroup label="XArena custom categories (not official game modes)">
                          {FREE_FIRE_CATEGORIES.filter((c) => CUSTOM_CATEGORY_VALUES.includes(c.value)).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </optgroup>
                      </select>
                    </Field>
                  )}
                  <Field id="t-desc" label="Description *" error={errors.description} count={form.description.length} max={1000}>
                    <textarea id="t-desc" rows={4} className={cn(inputCls(errors.description), "h-auto py-3")} value={form.description}
                      aria-invalid={Boolean(errors.description)} onChange={(e) => set("description", e.target.value)} placeholder="What is this tournament about?" />
                  </Field>

                  <div data-error={errors.rules ? "" : undefined}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/60">Rules *</span>
                      <span className="text-[11px] text-white/30">{form.rules.filter((r) => r.trim()).length} rule(s)</span>
                    </div>
                    <ol className="space-y-2">
                      {form.rules.map((r, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-6 text-center text-xs font-mono text-white/35">{i + 1}.</span>
                          <input aria-label={`Rule ${i + 1}`} className={cn(inputCls(errors.rules), "flex-1 min-w-0")} value={r} placeholder="e.g. Squad of 4 required"
                            onChange={(e) => set("rules", form.rules.map((x, j) => (j === i ? e.target.value : x)))} />
                          <IconBtn label={`Move rule ${i + 1} up`} disabled={i === 0} onClick={() => { const n = [...form.rules]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set("rules", n); }}><ArrowUp className="h-4 w-4" /></IconBtn>
                          <IconBtn label={`Move rule ${i + 1} down`} disabled={i === form.rules.length - 1} onClick={() => { const n = [...form.rules]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set("rules", n); }}><ArrowDown className="h-4 w-4" /></IconBtn>
                          <IconBtn label={`Remove rule ${i + 1}`} danger disabled={form.rules.length === 1 && !r} onClick={() => set("rules", form.rules.length > 1 ? form.rules.filter((_, j) => j !== i) : [""])}><Trash2 className="h-4 w-4" /></IconBtn>
                        </li>
                      ))}
                    </ol>
                    {errors.rules && <p role="alert" className="mt-1.5 text-xs text-crimson">{errors.rules}</p>}
                    <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => set("rules", [...form.rules, ""])}><Plus className="h-3.5 w-3.5" /> Add Rule</Button>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div data-error={errors.bannerUrl ? "" : undefined}>
                      <ImageInput label="Tournament Banner" hint="Wide · detail page & hero" value={form.bannerUrl} onChange={(v) => set("bannerUrl", v)} />
                      {errors.bannerUrl && <p role="alert" className="mt-1.5 text-xs text-crimson">{errors.bannerUrl}</p>}
                    </div>
                    <div data-error={errors.thumbnailUrl ? "" : undefined}>
                      <ImageInput label="Tournament Thumbnail" hint="Card image" aspect="aspect-[16/9]" value={form.thumbnailUrl} onChange={(v) => set("thumbnailUrl", v)} />
                      {errors.thumbnailUrl && <p role="alert" className="mt-1.5 text-xs text-crimson">{errors.thumbnailUrl}</p>}
                    </div>
                  </div>
                </Section>
              )}

              {step === "format" && (
                <Section title="Format" subtitle="How the tournament is played.">
                  <Field id="t-mode" label="Tournament Type *" error={errors.mode} hint={game ? `Modes supported by ${game.name}.` : undefined}>
                    <div role="radiogroup" aria-label="Tournament type" className="flex flex-wrap gap-2">
                      {modes.map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={form.mode === m} onClick={() => onMode(m)}
                          className={cn("h-11 rounded-xl px-4 text-sm font-semibold border", form.mode === m ? "gradient-brand border-transparent text-white" : "bg-surface-2 border-white/10 text-white/60 hover:text-white")}>
                          {gameModeLabel(m)}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field id="t-team" label="Team Size" error={errors.roomSize} hint="Players per team/room. Auto-set from the type; change it for custom formats.">
                    <input id="t-team" type="number" min={1} max={64} className={inputCls(errors.roomSize)} value={form.roomSize}
                      onChange={(e) => { setRoomSizeTouched(true); set("roomSize", Number(e.target.value)); }} />
                  </Field>
                  <Field id="t-map" label="Map (optional)" hint={isFF ? "Pick a preset or type a custom map name." : undefined}>
                    {isFF && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {FF_MAPS.map((m) => (
                          <button key={m} type="button" aria-pressed={form.map === m} onClick={() => set("map", m)}
                            className={cn("h-9 rounded-full px-3 text-xs border", form.map === m ? "bg-violet/20 border-violet/50 text-white" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{m}</button>
                        ))}
                      </div>
                    )}
                    <input id="t-map" className={inputCls()} value={form.map} maxLength={60} placeholder="Custom map name" onChange={(e) => set("map", e.target.value)} />
                  </Field>
                </Section>
              )}

              {step === "prize" && (
                <Section title="Entry & Prize" subtitle="Entry fee, capacity and prize distribution.">
                  <Field id="t-fmt" label="Entry type">
                    <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-2 gap-2">
                      {(["FREE", "PAID"] as const).map((f) => (
                        <button key={f} type="button" role="radio" aria-checked={form.format === f} disabled={locked}
                          onClick={() => { set("format", f); if (f === "FREE") set("entryFee", 0); }}
                          className={cn("h-12 rounded-xl text-sm font-semibold border disabled:opacity-50", form.format === f ? "gradient-brand border-transparent text-white" : "bg-surface-2 border-white/10 text-white/60")}>
                          {f === "FREE" ? "Free entry" : "Paid entry"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="t-fee" label="Entry Fee (₹)" error={errors.entryFee}>
                      <input id="t-fee" type="number" min={0} className={inputCls(errors.entryFee)} disabled={form.format === "FREE" || locked}
                        value={form.format === "FREE" ? 0 : form.entryFee} onChange={(e) => set("entryFee", Number(e.target.value))} />
                    </Field>
                    <Field id="t-slots" label="Maximum Players" error={errors.maxSlots} hint={`Capacity preview: 0 / ${form.maxSlots || 0} players`}>
                      <input id="t-slots" type="number" min={Math.max(2, slotsFilled)} className={inputCls(errors.maxSlots)} value={form.maxSlots} onChange={(e) => set("maxSlots", Number(e.target.value))} />
                    </Field>
                  </div>
                  {form.format === "PAID" && form.entryFee > 0 && (
                    <p className="text-[11px] text-white/35">Entry fees at full capacity: {inr(form.entryFee * form.maxSlots)} (estimate, informational only).</p>
                  )}
                  <Field id="t-pool" label="Prize Pool (₹)" error={errors.prizePool}>
                    <input id="t-pool" type="number" min={0} className={inputCls(errors.prizePool)} value={form.prizePool} onChange={(e) => set("prizePool", Number(e.target.value))} />
                  </Field>

                  <div data-error={errors.prizes ? "" : undefined}>
                    <span className="mb-1.5 block text-xs font-semibold text-white/60">Prize Distribution</span>
                    <div className="space-y-2">
                      {form.prizes.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-12 text-xs font-bold text-gold">{ordinal(i + 1)}</span>
                          <input aria-label={`${ordinal(i + 1)} prize in rupees`} type="number" min={0} className={cn(inputCls(), "flex-1 min-w-0")} value={p}
                            onChange={(e) => set("prizes", form.prizes.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
                          <IconBtn label={`Remove ${ordinal(i + 1)} prize`} danger onClick={() => set("prizes", form.prizes.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => set("prizes", [...form.prizes, 0])}><Plus className="h-3.5 w-3.5" /> Add Position</Button>
                    {errors.prizes && <p role="alert" className="mt-1.5 text-xs text-crimson">{errors.prizes}</p>}
                    <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <Summary label="Prize Pool" value={inr(form.prizePool)} />
                      <Summary label="Distributed" value={inr(distributed)} />
                      <Summary label="Remaining" value={inr(remaining)} tone={remaining === 0 ? "ok" : remaining < 0 ? "bad" : "warn"} />
                    </dl>
                    {remaining > 0 && <p className="mt-2 text-[11px] text-gold">{inr(remaining)} of the pool isn&apos;t assigned to any position yet.</p>}
                  </div>
                </Section>
              )}

              {step === "schedule" && (
                <Section title="Schedule" subtitle={tz ? `All times are in your timezone: ${tz}` : "Registration and match timing."}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="t-rs" label="Registration Opens *" error={errors.regStarts}><input id="t-rs" type="datetime-local" className={inputCls(errors.regStarts)} value={form.regStarts} onChange={(e) => set("regStarts", e.target.value)} /></Field>
                    <Field id="t-re" label="Registration Closes *" error={errors.regEnds}><input id="t-re" type="datetime-local" className={inputCls(errors.regEnds)} value={form.regEnds} onChange={(e) => set("regEnds", e.target.value)} /></Field>
                    <Field id="t-ms" label="Match Starts *" error={errors.matchStarts}><input id="t-ms" type="datetime-local" className={inputCls(errors.matchStarts)} value={form.matchStarts} onChange={(e) => set("matchStarts", e.target.value)} /></Field>
                    <Field id="t-me" label="Match Ends (optional)" error={errors.matchEnds}><input id="t-me" type="datetime-local" className={inputCls(errors.matchEnds)} value={form.matchEnds} onChange={(e) => set("matchEnds", e.target.value)} /></Field>
                  </div>
                  <p className="text-[11px] text-white/30">Rules: registration opens before it closes · match starts on/after registration closes · match ends after it starts.</p>
                  {form.matchStarts && localInputToIso(form.matchStarts) && <p className="text-xs text-white/50">Match starts {formatDateTimeFull(localInputToIso(form.matchStarts)!)}</p>}
                </Section>
              )}

              {step === "room" && (
                <Section title="Room Settings" subtitle="Room credentials are private until you release them.">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                    <KeyRound className="h-5 w-5 text-gold" />
                    <p className="text-sm text-white/80">Room ID and password are not set while creating a tournament.</p>
                    <p className="text-xs text-white/45">
                      After the tournament exists, open it from the Tournaments list and use <strong className="text-white/70">Release Room</strong>.
                      Credentials are only sent to joined participants at release time and are never part of the public API.
                    </p>
                  </div>
                </Section>
              )}

              {step === "advanced" && (
                <Section title="Advanced" subtitle="Optional settings.">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <p id="feat-label" className="text-sm font-semibold text-white">Featured tournament</p>
                      <p className="text-xs text-white/40">Highlighted on the homepage.</p>
                    </div>
                    <button type="button" role="switch" aria-checked={form.isFeatured} aria-labelledby="feat-label" onClick={() => set("isFeatured", !form.isFeatured)}
                      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", form.isFeatured ? "bg-gold" : "bg-white/15")}>
                      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all", form.isFeatured ? "left-[22px]" : "left-0.5")} />
                    </button>
                  </div>
                  <Field id="t-cad" label="Schedule type">
                    <select id="t-cad" className={inputCls()} value={form.cadence} onChange={(e) => set("cadence", e.target.value)}>
                      <option value="ONE_OFF">One-off</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MEGA">Mega</option>
                    </select>
                  </Field>
                  <Field id="t-score" label="Scoring system (optional)" error={errors.scoringSystem}>
                    <textarea id="t-score" rows={3} className={cn(inputCls(), "h-auto py-3")} value={form.scoringSystem} onChange={(e) => set("scoringSystem", e.target.value)} placeholder="e.g. 1 point per kill, placement bonus…" />
                  </Field>
                  <Field id="t-notes" label="Admin notes (private)" error={errors.adminNotes}>
                    <textarea id="t-notes" rows={3} className={cn(inputCls(), "h-auto py-3")} value={form.adminNotes} onChange={(e) => set("adminNotes", e.target.value)} placeholder="Only admins see this." />
                  </Field>
                  <p className="text-[11px] text-white/30">Visibility: drafts never appear publicly. Publishing happens through the Create / Publish button after a completeness check.</p>
                </Section>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-4">
            <Button variant="ghost" disabled={idx === 0} onClick={() => goStep(STEPS[idx - 1].id)}><ArrowLeft className="h-4 w-4" /> Back</Button>
            <span className="text-[11px] text-white/30">Step {idx + 1} of {STEPS.length}</span>
            <Button variant="secondary" disabled={idx === STEPS.length - 1} onClick={() => goStep(STEPS[idx + 1].id)}>Next <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <aside className={cn("lg:sticky lg:top-6", !previewOpen && "hidden lg:block")}>
          <div className="rounded-3xl border border-white/10 bg-surface/60 p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/60"><Eye className="h-3.5 w-3.5 text-violet" /> Live preview</p>
            <TournamentPreview d={{
              title: form.title, gameName: game?.name ?? "", categoryLabel: cat?.label ?? null, categoryCustom: CUSTOM_CATEGORY_VALUES.includes(form.category ?? ""),
              entryFee: form.entryFee, isFree: form.format === "FREE", prizePool: form.prizePool, maxSlots: form.maxSlots, map: form.map,
              bannerUrl: form.bannerUrl, thumbnailUrl: form.thumbnailUrl, matchStartsAt: localInputToIso(form.matchStarts) ?? null, status: previewStatus,
            }} />
          </div>
        </aside>
      </div>

      {/* Mobile sticky actions */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-void/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2">
        {!isPublished && <Button variant="secondary" fullWidth onClick={onSaveDraft} loading={saving === "draft"} disabled={busy}>Save Draft</Button>}
        <Button fullWidth onClick={onCreate} loading={saving === "create"} disabled={busy}>{isPublished ? "Save Changes" : editing ? "Publish" : "Create"}</Button>
      </div>

      <Dialog open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Publish Tournament?">
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">{form.title}</span> will {editing ? "be saved and " : "be created and "}become visible to players according to public listing rules.
            Or keep it as a draft and publish later.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy} onClick={() => { setConfirmOpen(false); void persist("create", false); }}>Keep as draft</Button>
            <Button disabled={busy} loading={busy} onClick={() => { void persist("create", true).finally(() => setConfirmOpen(false)); }}><Rocket className="h-4 w-4" /> Publish now</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={cn("grid h-11 w-9 shrink-0 place-items-center rounded-xl text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-30", danger && "hover:text-crimson")}>
      {children}
    </button>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl bg-white/5 py-2">
      <dd className={cn("text-sm font-black", tone === "ok" && "text-signal", tone === "warn" && "text-gold", tone === "bad" && "text-crimson", !tone && "text-white")}>{value}</dd>
      <dt className="text-[10px] uppercase tracking-wide text-white/35">{label}</dt>
    </div>
  );
}
