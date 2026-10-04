"use client";

import { useId, useRef, useState } from "react";
import { ImageIcon, Link2, Loader2, RefreshCw, Trash2, Upload, Monitor, Smartphone, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB, validateImageUrl } from "@/lib/image-url";

interface ImageInputProps {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  hint?: string;
  /** Tailwind aspect class for the desktop preview frame. */
  aspect?: string;
  alt?: string;
  disabled?: boolean;
}

/**
 * Reusable admin image field: upload a file (stored via /api/admin/uploads, we keep only
 * the returned path) OR paste an http(s) URL. Shows an immediate preview with
 * desktop/mobile framing, load-failure handling, and replace / remove / retry.
 */
export function ImageInput({ label, value, onChange, hint, aspect = "aspect-[16/7]", alt, disabled }: ImageInputProps) {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"upload" | "url">(value && /^https?:/.test(value) ? "url" : "upload");
  const [urlDraft, setUrlDraft] = useState(value && /^https?:/.test(value) ? value : "");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [frame, setFrame] = useState<"desktop" | "mobile">("desktop");

  const upload = (file: File) => {
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return setError("Only PNG, JPG or WebP images are allowed.");
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError(`Image is too large. Maximum size is ${MAX_IMAGE_MB} MB.`);

    // XHR (not fetch) so we can show real upload progress.
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    setProgress(0);
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => {
      setProgress(null);
      setError("Upload failed. Check your connection and try again.");
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const res = JSON.parse(xhr.responseText) as { success: boolean; data?: { url: string }; error?: string };
        if (!res.success || !res.data) return setError(res.error ?? "Upload failed.");
        setFailed(false);
        onChange(res.data.url);
      } catch {
        setError("Upload failed.");
      }
    };
    xhr.open("POST", "/api/admin/uploads");
    xhr.withCredentials = true;
    xhr.send(body);
  };

  const applyUrl = () => {
    const problem = validateImageUrl(urlDraft);
    if (problem) return setError(problem);
    setError(null);
    setFailed(false);
    onChange(urlDraft.trim());
  };

  const remove = () => {
    setError(null);
    setFailed(false);
    setUrlDraft("");
    if (fileRef.current) fileRef.current.value = "";
    onChange(null);
  };

  const tabBtn = (key: "upload" | "url", icon: React.ReactNode, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => {
        setTab(key);
        setError(null);
      }}
      className={cn(
        "flex-1 h-10 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors",
        tab === key ? "bg-violet/20 text-white" : "text-white/50 hover:text-white"
      )}
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span id={`${uid}-label`} className="text-xs font-semibold text-white/60">
          {label}
        </span>
        {hint && <span className="text-[11px] text-white/30 text-right">{hint}</span>}
      </div>

      {value ? (
        <div className="space-y-2">
          <div className="flex gap-1 justify-end" role="group" aria-label="Preview size">
            {(["desktop", "mobile"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrame(f)}
                aria-pressed={frame === f}
                aria-label={`${f} preview`}
                className={cn("h-8 w-8 rounded-lg grid place-items-center", frame === f ? "bg-white/10 text-white" : "text-white/35 hover:text-white")}
              >
                {f === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <div className={cn("relative overflow-hidden rounded-2xl border border-white/10 bg-surface-2 mx-auto", frame === "mobile" ? "max-w-[220px] aspect-[4/5]" : cn("w-full", aspect))}>
            {failed ? (
              <div role="alert" className="absolute inset-0 grid place-items-center text-center p-4 gap-2">
                <div>
                  <AlertTriangle className="h-6 w-6 text-gold mx-auto mb-1.5" />
                  <p className="text-xs text-white/70">Image could not be loaded.</p>
                </div>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${value}-${retryKey}`}
                src={value}
                alt={alt ?? `${label} preview`}
                onError={() => setFailed(true)}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {failed && (
              <Button type="button" size="sm" variant="secondary" onClick={() => { setFailed(false); setRetryKey((k) => k + 1); }}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => onChange(null)} aria-label={`Replace ${label}`}>
              <Upload className="h-3.5 w-3.5" /> Replace
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={remove} aria-label={`Remove ${label}`}>
              <Trash2 className="h-3.5 w-3.5 text-crimson" /> Remove
            </Button>
          </div>
          <p className="text-[11px] text-white/30 truncate" title={value}>
            {value.startsWith("/api/uploads/") ? "Uploaded image" : value}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-surface-2/60 p-3 space-y-3">
          <div role="tablist" aria-labelledby={`${uid}-label`} className="flex gap-1 rounded-xl bg-black/20 p-1">
            {tabBtn("upload", <Upload className="h-3.5 w-3.5" />, "Upload Image")}
            {tabBtn("url", <Link2 className="h-3.5 w-3.5" />, "Use Image URL")}
          </div>

          {tab === "upload" ? (
            <div>
              <input
                ref={fileRef}
                id={`${uid}-file`}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                disabled={disabled || progress !== null}
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              />
              <label
                htmlFor={`${uid}-file`}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-6 px-3 text-center cursor-pointer hover:border-violet/50 focus-within:border-violet min-h-[44px]"
              >
                {progress !== null ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-violet" />
                    <span className="text-xs text-white/70">Uploading… {progress}%</span>
                    <span className="h-1 w-32 rounded-full bg-white/10 overflow-hidden">
                      <span className="block h-full gradient-brand" style={{ width: `${progress}%` }} />
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-5 w-5 text-white/40" />
                    <span className="text-xs text-white/70">Tap to choose an image</span>
                    <span className="text-[11px] text-white/30">PNG, JPG or WebP · up to {MAX_IMAGE_MB} MB</span>
                  </>
                )}
              </label>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={urlDraft}
                onChange={(e) => { setUrlDraft(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyUrl())}
                inputMode="url"
                placeholder="https://example.com/banner.webp"
                aria-label={`${label} URL`}
                aria-invalid={Boolean(error)}
                className="flex-1 min-w-0 h-11 rounded-xl bg-surface-2 border border-white/10 px-3.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet/60 focus:ring-2 focus:ring-violet/20"
              />
              <Button type="button" size="md" variant="secondary" onClick={applyUrl}>
                Preview
              </Button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-crimson">
          {error}
        </p>
      )}
    </div>
  );
}
