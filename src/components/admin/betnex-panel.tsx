"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Copy, Plug, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useBetnexEnable, useBetnexStatus, useBetnexSync, useBetnexTest } from "@/hooks/use-provider-admin";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/50 shrink-0">{label}</span>
      <span className="text-sm text-white text-right break-all">{children}</span>
    </div>
  );
}

function Flag({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? (
    <Badge tone="signal"><CheckCircle2 className="h-3 w-3" />{yes}</Badge>
  ) : (
    <Badge tone="crimson"><XCircle className="h-3 w-3" />{no}</Badge>
  );
}

const errMsg = (e: unknown) => (e instanceof ApiClientError ? e.message : "Try again.");

export function BetnexPanel() {
  const { data: s, isLoading } = useBetnexStatus();
  const test = useBetnexTest();
  const sync = useBetnexSync();
  const enable = useBetnexEnable();
  const [filter, setFilter] = useState("");

  const providers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (s?.providers ?? []).filter((p) => !q || p.providerName.toLowerCase().includes(q));
  }, [s?.providers, filter]);

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (r) => toast({ title: r.ok ? "Connection OK" : "Connection failed", description: r.ok ? `${r.providerCount} providers available on your key` : r.error, tone: r.ok ? "success" : "error" }),
      onError: (e) => toast({ title: "Test failed", description: errMsg(e), tone: "error" }),
    });

  const runSync = () =>
    sync.mutate(undefined, {
      onSuccess: () => toast({ title: "Catalogue synced", description: "New games start disabled — enable the providers you want below.", tone: "success" }),
      onError: (e) => toast({ title: "Sync failed", description: errMsg(e), tone: "error" }),
    });

  const toggle = (input: { enabled: boolean; providerName?: string; all?: boolean }, label: string) => {
    if (input.all && !window.confirm(`${input.enabled ? "Enable" : "Disable"} ALL ${s?.catalogue.available ?? ""} BETNEX games for players?`)) return;
    enable.mutate(input, {
      onSuccess: (r) => toast({ title: `${label}: ${r.changed} games ${input.enabled ? "enabled" : "disabled"}`, tone: "success" }),
      onError: (e) => toast({ title: "Couldn't update", description: errMsg(e), tone: "error" }),
    });
  };

  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied", tone: "success" }),
      () => toast({ title: "Couldn't copy", tone: "error" })
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Game Provider · BETNEX</h1>
        <div className="flex gap-2">
          <Button variant="secondary" loading={test.isPending} onClick={runTest}><Plug className="h-4 w-4" /> Test connection</Button>
          <Button loading={sync.isPending} disabled={!s?.configured} onClick={runSync}><RefreshCw className="h-4 w-4" /> Sync games</Button>
        </div>
      </div>

      {isLoading || !s ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          {s.notes.length > 0 && (
            <Card className="p-4 space-y-2 border-gold/30">
              <div className="flex items-center gap-2 text-gold text-sm font-bold"><TriangleAlert className="h-4 w-4" /> Before you go live</div>
              <ul className="space-y-1.5 text-xs text-white/70 list-disc pl-5">
                {s.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-white text-sm">Setup</h2>
                <div className="flex gap-1.5">
                  <Badge tone={s.testMode ? "gold" : "neutral"}>{s.testMode ? "TEST MODE" : "LIVE MODE"}</Badge>
                  <Badge tone={s.configured ? "signal" : "crimson"}>{s.configured ? "READY" : "NOT READY"}</Badge>
                </div>
              </div>
              <Row label="API base URL">{s.config.apiBaseUrl}</Row>
              <Row label="API key"><Flag ok={s.config.apiKeyConfigured} yes="configured" no="missing" /></Row>
              <Row label="Username code">{s.config.usernameCode ? `${s.config.usernameCode} (${s.config.usernamePosition})` : <Badge tone="crimson">missing</Badge>}</Row>
              <Row label="Encryption key"><Flag ok={s.config.encryptionConfigured} yes="configured" no="missing" /></Row>
              <Row label="Callback IP allowlist">{s.config.callbackIpCount > 0 ? `${s.config.callbackIpCount} IPs` : <Badge tone="crimson">empty — callbacks rejected</Badge>}</Row>
              <Row label="Public app URL">
                {s.config.publicAppUrl ? <>{s.config.publicAppUrl} {!s.config.publicUrlIsHttps && <Badge tone="crimson">must be https</Badge>}</> : <Badge tone="crimson">APP_PUBLIC_URL not set</Badge>}
              </Row>
              <Row label="Callback URL (give to BETNEX)">
                {s.config.callbackUrl ? (
                  <span className="inline-flex items-center gap-2">
                    {s.config.callbackUrl}
                    <button type="button" aria-label="Copy callback URL" onClick={() => copy(s.config.callbackUrl!)} className="text-white/50 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                  </span>
                ) : "—"}
              </Row>
            </Card>

            <Card className="p-5">
              <h2 className="font-bold text-white text-sm mb-2">Catalogue &amp; health</h2>
              <Row label="INR games available">{s.catalogue.available}</Row>
              <Row label="Enabled for players">{s.catalogue.enabled}</Row>
              <Row label="Last sync">
                {s.catalogue.lastSync
                  ? <>{formatDateTime(s.catalogue.lastSync.at)} · {s.catalogue.lastSync.ok ? `${s.catalogue.lastSync.total} games from ${s.catalogue.lastSync.providers - s.catalogue.lastSync.failedProviders}/${s.catalogue.lastSync.providers} providers` : <Badge tone="crimson">failed</Badge>}</>
                  : "never"}
              </Row>
              <Row label="Last API request">
                {s.lastRequest ? <>{formatDateTime(s.lastRequest.createdAt)} · {s.lastRequest.ok ? <Badge tone="signal">ok</Badge> : <Badge tone="crimson">{s.lastRequest.errorKind ?? "failed"}</Badge>}</> : "none"}
              </Row>
              <Row label="Failed API requests (24h)">{s.failedRequests24h}</Row>
              <Row label="Rejected / failed callbacks (24h)">{s.problemCallbacks24h > 0 ? <Badge tone="crimson">{s.problemCallbacks24h}</Badge> : 0}</Row>
            </Card>
          </div>

          <Card className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-white text-sm">Games shown to players</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" loading={enable.isPending} onClick={() => toggle({ enabled: false, all: true }, "All games")}>Disable all</Button>
                <Button size="sm" loading={enable.isPending} onClick={() => toggle({ enabled: true, all: true }, "All games")}>Enable all</Button>
              </div>
            </div>
            <p className="text-xs text-white/45">BETNEX has thousands of titles, so newly synced games start disabled. Turn on the game studios you want to offer.</p>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search provider…" />
            {providers.length === 0 ? (
              <p className="text-sm text-white/40 py-4 text-center">{s.providers.length === 0 ? "No games yet — press “Sync games”." : "No provider matches."}</p>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[28rem] overflow-y-auto">
                {providers.map((p) => (
                  <li key={p.providerName} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-semibold truncate">{p.providerName}</p>
                      <p className="text-[11px] text-white/40">{p.enabled} of {p.total} enabled</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="secondary" disabled={p.enabled === 0 || enable.isPending} onClick={() => toggle({ enabled: false, providerName: p.providerName }, p.providerName)}>Off</Button>
                      <Button size="sm" disabled={p.enabled === p.total || enable.isPending} onClick={() => toggle({ enabled: true, providerName: p.providerName }, p.providerName)}>On</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-white text-sm mb-3">Recent callbacks</h2>
            {s.recentCallbacks.length === 0 ? (
              <p className="text-sm text-white/40 py-2">No callbacks yet. They only start after you go live (test your handler with the BETNEX Callback Tester first).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-white/40">
                    <tr><th className="py-1.5 pr-3">Time</th><th className="pr-3">HTTP</th><th className="pr-3">Outcome</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {s.recentCallbacks.map((c, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-1.5 pr-3 text-white/60 whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                        <td className="pr-3"><Badge tone={c.httpStatus === 200 ? "signal" : "crimson"}>{c.httpStatus}</Badge></td>
                        <td className="pr-3 text-white">{c.outcome}</td>
                        <td className="text-white/50 break-all">{c.error ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
