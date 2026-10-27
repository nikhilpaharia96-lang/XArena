"use client";
import { useMemo, useState } from "react";
import {
  useAdminBanners,
  useCreateBanner,
  useDeleteBanner,
  useReorderBanners,
  useUpdateBanner,
  type AdminBannerRow,
} from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { ImageInput } from "@/components/admin/image-input";
import { HeroSlide } from "@/components/home/hero-slide";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { ArrowDown, ArrowUp, Eye, EyeOff, Image as ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";

interface FormState {
  title: string;
  subtitle: string;
  badgeText: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  ctaLabel: string;
  secondaryCtaLabel: string;
  secondaryCtaUrl: string;
  startsAt: string; // datetime-local value
  endsAt: string;
}

const EMPTY: FormState = {
  title: "", subtitle: "", badgeText: "", imageUrl: "", mobileImageUrl: "", linkUrl: "",
  ctaLabel: "", secondaryCtaLabel: "", secondaryCtaUrl: "", startsAt: "", endsAt: "",
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

function fromRow(b: AdminBannerRow): FormState {
  return {
    title: b.title, subtitle: b.subtitle ?? "", badgeText: b.badgeText ?? "", imageUrl: b.imageUrl,
    mobileImageUrl: b.mobileImageUrl ?? "", linkUrl: b.linkUrl ?? "", ctaLabel: b.ctaLabel ?? "",
    secondaryCtaLabel: b.secondaryCtaLabel ?? "", secondaryCtaUrl: b.secondaryCtaUrl ?? "",
    startsAt: toLocalInput(b.startsAt), endsAt: toLocalInput(b.endsAt),
  };
}

/** Live / Scheduled / Expired / Hidden — what players actually see right now. */
function statusOf(b: AdminBannerRow): { label: string; tone: "signal" | "gold" | "crimson" | "neutral" } {
  if (!b.isActive) return { label: "Hidden", tone: "neutral" };
  const now = Date.now();
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return { label: "Scheduled", tone: "gold" };
  if (b.endsAt && new Date(b.endsAt).getTime() <= now) return { label: "Expired", tone: "crimson" };
  return { label: "Live", tone: "signal" };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs font-semibold text-white/60">
        {label}
        {hint && <span className="font-normal text-white/30">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function AdminBannersPage() {
  const { data, isLoading } = useAdminBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const reorder = useReorderBanners();

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<AdminBannerRow | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const liveCount = useMemo(() => (data ?? []).filter((b) => statusOf(b).label === "Live").length, [data]);

  const openNew = () => { setForm(EMPTY); setEditingId("new"); };
  const openEdit = (b: AdminBannerRow) => { setForm(fromRow(b)); setEditingId(b.id); };
  const close = () => setEditingId(null);

  const errorToast = (title: string) => (err: unknown) =>
    toast({ title, description: err instanceof ApiClientError ? err.message : "", tone: "error" });

  const save = () => {
    if (!form.title.trim()) return toast({ title: "Headline is required", tone: "error" });
    if (!form.imageUrl) return toast({ title: "Please add a hero image", tone: "error" });
    if (form.ctaLabel && !form.linkUrl) return toast({ title: "Add a button link, or clear the button text", tone: "error" });
    if (form.secondaryCtaLabel && !form.secondaryCtaUrl) return toast({ title: "Add a second button link, or clear its text", tone: "error" });

    const payload = { ...form, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt) };
    if (editingId === "new") {
      createBanner.mutate(payload, {
        onSuccess: () => { toast({ title: "Hero slide created", tone: "success" }); close(); },
        onError: errorToast("Couldn't create slide"),
      });
    } else if (editingId) {
      updateBanner.mutate({ id: editingId, ...payload }, {
        onSuccess: () => { toast({ title: "Hero slide updated", tone: "success" }); close(); },
        onError: errorToast("Couldn't save changes"),
      });
    }
  };

  const toggle = (b: AdminBannerRow) =>
    updateBanner.mutate({ id: b.id, isActive: !b.isActive }, {
      onSuccess: () => toast({ title: b.isActive ? "Slide hidden from home page" : "Slide is now visible", tone: "success" }),
      onError: errorToast("Couldn't update slide"),
    });

  const move = (index: number, dir: -1 | 1) => {
    if (!data) return;
    const ids = data.map((b) => b.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    reorder.mutate(ids, { onError: errorToast("Couldn't reorder") });
  };

  const remove = () => {
    if (!confirmDelete) return;
    deleteBanner.mutate(confirmDelete.id, {
      onSuccess: () => { toast({ title: "Slide deleted", tone: "success" }); setConfirmDelete(null); },
      onError: errorToast("Couldn't delete slide"),
    });
  };

  const saving = createBanner.isPending || updateBanner.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Hero Banners</h1>
          <p className="text-sm text-white/50 mt-1">
            Slides shown at the top of the home page, in this order. {liveCount > 0
              ? `${liveCount} live now.`
              : "None live — the home page shows the default XArena intro slides."}
          </p>
        </div>
        {editingId === null && (
          <Button onClick={openNew}><Plus className="h-4 w-4" /> Add Slide</Button>
        )}
      </div>

      {editingId !== null && (
        <Card className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">{editingId === "new" ? "New hero slide" : "Edit hero slide"}</h2>
            <button onClick={close} aria-label="Close editor" className="h-9 w-9 grid place-items-center rounded-lg text-white/50 hover:text-white hover:bg-white/5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live preview — same component the home page renders */}
          <div>
            <p className="text-xs font-semibold text-white/60 mb-2">Live preview</p>
            <div className="rounded-3xl border border-white/10 bg-void p-2 overflow-hidden">
              {form.imageUrl ? (
                <HeroSlide slide={{ ...form, title: form.title || "Your headline here" }} className="sm:w-full" />
              ) : (
                <div className="h-48 grid place-items-center text-sm text-white/30">Add a hero image to see the preview</div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Headline *" hint={`${form.title.length}/120`}>
              <Input placeholder="e.g. Mega Friday — ₹5 Lakh Prize Pool" maxLength={120} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Small badge" hint="optional">
              <Input placeholder="e.g. LIMITED TIME" maxLength={40} value={form.badgeText} onChange={(e) => set("badgeText", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Sub-text" hint={`${form.subtitle.length}/220 · optional`}>
                <Input placeholder="One short supporting line" maxLength={220} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ImageInput label="Hero image *" hint="Wide, ~1600×700" value={form.imageUrl || null} onChange={(v) => set("imageUrl", v ?? "")} aspect="aspect-[16/7]" />
            <ImageInput label="Mobile image" hint="Optional — portrait-friendly crop" value={form.mobileImageUrl || null} onChange={(v) => set("mobileImageUrl", v ?? "")} aspect="aspect-[16/7]" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Main button text" hint="optional">
              <Input placeholder="e.g. Join Now" maxLength={30} value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} />
            </Field>
            <Field label="Main button link" hint="/tournaments or https://…">
              <Input placeholder="/tournaments" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} />
            </Field>
            <Field label="Second button text" hint="optional">
              <Input placeholder="e.g. Learn More" maxLength={30} value={form.secondaryCtaLabel} onChange={(e) => set("secondaryCtaLabel", e.target.value)} />
            </Field>
            <Field label="Second button link">
              <Input placeholder="/referral" value={form.secondaryCtaUrl} onChange={(e) => set("secondaryCtaUrl", e.target.value)} />
            </Field>
            <Field label="Show from" hint="optional">
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </Field>
            <Field label="Hide after" hint="optional">
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button loading={saving} onClick={save}>{editingId === "new" ? "Create Slide" : "Save Changes"}</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((b, i) => {
            const st = statusOf(b);
            return (
              <Card key={b.id} className={cn("overflow-hidden flex flex-col sm:flex-row", !b.isActive && "opacity-70")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.imageUrl} alt={b.title} className="w-full sm:w-56 h-32 sm:h-auto object-cover" />
                <div className="flex-1 min-w-0 p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <span className="text-[11px] text-white/35">#{i + 1}</span>
                  </div>
                  <p className="text-sm font-bold text-white truncate">{b.title}</p>
                  {b.subtitle && <p className="text-xs text-white/50 line-clamp-1">{b.subtitle}</p>}
                  {(b.startsAt || b.endsAt) && (
                    <p className="text-[11px] text-white/35">
                      {b.startsAt ? `From ${new Date(b.startsAt).toLocaleString()}` : ""}
                      {b.startsAt && b.endsAt ? " · " : ""}
                      {b.endsAt ? `Until ${new Date(b.endsAt).toLocaleString()}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => toggle(b)} disabled={updateBanner.isPending}>
                      {b.isActive ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Show</>}
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === data.length - 1 || reorder.isPending} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" aria-label="Delete slide" onClick={() => setConfirmDelete(b)}><Trash2 className="h-4 w-4 text-crimson" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        editingId === null && <EmptyState icon={ImageIcon} title="No hero slides yet" description="Add your first slide to replace the default intro on the home page." />
      )}

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete this slide?">
        <p className="text-sm text-white/60 mb-4">“{confirmDelete?.title}” will be removed from the home page permanently.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteBanner.isPending} onClick={remove}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}
