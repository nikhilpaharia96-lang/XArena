"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { EMPTY_EXTRAS, useProfileExtras, type ProfileExtras } from "@/lib/profile-extras";
import { Avatar, Panel, SectionTitle } from "@/components/profile/parts";
import {
  ArrowLeft, ChevronRight, Copy, Camera, User, Mail, Phone, CalendarDays, MapPin, Share2, Gamepad2,
  SlidersHorizontal, Image as ImageIcon, Plus, AtSign, Play, MessageCircle, IdCard, Users, Pencil, ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const inputCls =
  "w-full h-11 rounded-xl bg-void/60 border border-white/10 px-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-cobalt/70 focus:ring-2 focus:ring-cobalt/20";

function Field({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="flex items-center gap-2.5 w-[38%] shrink-0 text-[13px] text-white/85">
        <Icon className="h-[18px] w-[18px] text-white/55 shrink-0" /> {label}
      </span>
      <div className="flex-1 min-w-0 relative">{children}</div>
    </div>
  );
}

function Verified() {
  return (
    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-signal/40 bg-signal/10 px-2 py-0.5 text-[11px] font-semibold text-signal">
      Verified
    </span>
  );
}

const PRESET_COLORS: [string, string][] = [["#F97316", "#7C2D12"], ["#A855F7", "#1E1B4B"], ["#64748B", "#0F172A"]];

/** Generates a small gradient avatar as a data URL so presets need no image files. */
function presetAvatar(i: number, letter: string) {
  const [a, b] = PRESET_COLORS[i];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/><text x="128" y="170" font-family="Arial" font-weight="900" font-size="130" fill="white" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Center-crops and shrinks an uploaded image to 256px JPEG to keep the stored value small. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

export default function AccountSettingsPage() {
  useRequireAuth();
  const { data, isLoading } = useProfile();
  const update = useUpdateProfile();
  const { extras, save: saveExtras } = useProfileExtras(data?.profile.id);

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileExtras>(EMPTY_EXTRAS);
  const fileRef = useRef<HTMLInputElement>(null);
  const seeded = useRef(false);

  // Seed the form once the profile (and local extras) have loaded.
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setDisplayName(data.profile.displayName ?? data.profile.username);
    setPhone(data.profile.phone ?? "");
    setAvatarUrl(data.profile.avatarUrl);
  }, [data]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(extras);
  }, [extras]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const { profile } = data;
  const name = displayName || profile.username;
  const setX = (k: keyof ProfileExtras) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(profile.uid);
      toast({ title: "User ID copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy User ID", tone: "error" });
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setAvatarUrl(await fileToAvatar(file));
    } catch {
      toast({ title: "That image couldn't be read", tone: "error" });
    }
  };

  const onSave = () => {
    const cleanPhone = phone.trim();
    if (cleanPhone && !/^[0-9]{10}$/.test(cleanPhone)) {
      toast({ title: "Enter a valid 10-digit phone number", tone: "error" });
      return;
    }
    saveExtras(form);
    const payload: { displayName?: string; phone?: string; avatarUrl?: string } = {};
    if (displayName.trim()) payload.displayName = displayName.trim();
    if (cleanPhone) payload.phone = cleanPhone;
    if (avatarUrl) payload.avatarUrl = avatarUrl;
    update.mutate(payload, {
      onSuccess: () => toast({ title: "Profile updated", tone: "success" }),
      onError: () => toast({ title: "Couldn't save changes", tone: "error" }),
    });
  };

  const presets = [0, 1, 2].map((i) => presetAvatar(i, (name[0] ?? "X").toUpperCase()));

  return (
    <div className="mx-auto w-full max-w-xl pb-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/profile" aria-label="Back to settings" className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center text-white hover:bg-white/5">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
      </div>

      <div className="rounded-2xl bg-surface/80 border border-white/10 p-4 flex items-center gap-4">
        <div className="relative">
          <Avatar url={avatarUrl} name={name} size={72} />
          <button
            type="button"
            aria-label="Change photo"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-surface-2 border border-white/15 flex items-center justify-center"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-white truncate">{name}</p>
          <p className="text-sm text-white/60 truncate">{profile.email}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
            User ID: <span className="font-mono">{profile.uid}</span>
            <button type="button" aria-label="Copy user ID" onClick={() => void copyUid()} className="text-white/50 hover:text-white">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/40 shrink-0" />
      </div>

      <SectionTitle icon={User}>Profile Information</SectionTitle>
      <Panel>
        <Field icon={User} label="Full Name">
          <input className={`${inputCls} pr-9`} value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} />
          <Pencil className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
        </Field>
        <Field icon={Mail} label="Email Address">
          <input className={`${inputCls} ${profile.emailVerified ? "pr-20" : ""} text-white/70`} value={profile.email} readOnly />
          {profile.emailVerified && <Verified />}
        </Field>
        <Field icon={Phone} label="Phone Number">
          <input className={`${inputCls} pr-9`} value={phone} inputMode="numeric" maxLength={10} placeholder="10-digit number" onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
          <Pencil className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
        </Field>
        <Field icon={CalendarDays} label="Date of Birth">
          <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.dob} max={new Date().toISOString().slice(0, 10)} onChange={setX("dob")} />
        </Field>
        <Field icon={Users} label="Gender">
          <select className={`${inputCls} appearance-none pr-9`} value={form.gender} onChange={setX("gender")}>
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
        </Field>
        <Field icon={MapPin} label="Location">
          <input className={`${inputCls} pr-9`} value={form.location} placeholder="City, State" onChange={setX("location")} />
          <Pencil className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
        </Field>
      </Panel>

      <SectionTitle icon={Share2}>Social Links</SectionTitle>
      <Panel>
        <Field icon={AtSign} label="Instagram">
          <input className={inputCls} value={form.instagram} placeholder="@username" onChange={setX("instagram")} />
        </Field>
        <Field icon={Play} label="YouTube">
          <input className={inputCls} value={form.youtube} placeholder="Channel name" onChange={setX("youtube")} />
        </Field>
        <Field icon={MessageCircle} label="Discord">
          <input className={inputCls} value={form.discord} placeholder="Not linked" onChange={setX("discord")} />
        </Field>
      </Panel>

      <SectionTitle icon={SlidersHorizontal}>Preferences</SectionTitle>
      <Panel>
        <Field icon={Gamepad2} label="Preferred Games">
          <input className={inputCls} value={form.preferredGames} placeholder="Free Fire, BGMI…" onChange={setX("preferredGames")} />
        </Field>
        <Field icon={IdCard} label="Display Name">
          <input className={inputCls} value={displayName} maxLength={30} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
      </Panel>

      <SectionTitle icon={ImageIcon}>Profile Picture</SectionTitle>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
      <div className="grid grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="aspect-[4/5] rounded-xl border border-dashed border-white/25 bg-surface/60 flex flex-col items-center justify-center gap-1 text-xs text-white/70"
        >
          <Plus className="h-5 w-5" /> Upload
        </button>
        {[avatarUrl && !presets.includes(avatarUrl) ? avatarUrl : null, ...presets].map((src, i) =>
          i === 0 && !src ? (
            <button key="cur" type="button" className="aspect-[4/5] rounded-xl overflow-hidden ring-2 ring-cobalt shadow-[0_0_14px_rgba(59,130,246,0.6)]">
              <Avatar url={null} name={name} size={200} className="!h-full !w-full rounded-none ring-0" />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              aria-label="Use this avatar"
              onClick={() => src && setAvatarUrl(src)}
              className={`aspect-[4/5] rounded-xl overflow-hidden ${src === avatarUrl ? "ring-2 ring-cobalt shadow-[0_0_14px_rgba(59,130,246,0.6)]" : "ring-1 ring-white/10"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {src && <img src={src} alt="" className="h-full w-full object-cover" />}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={update.isPending}
        className="mt-6 w-full h-14 rounded-xl gradient-brand text-white text-base font-bold shadow-[0_8px_24px_-8px_rgba(37,99,235,0.7)] disabled:opacity-60"
      >
        {update.isPending ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
