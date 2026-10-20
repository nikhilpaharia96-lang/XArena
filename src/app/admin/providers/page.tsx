"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Plug, RefreshCw, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatDateTime, formatPaiseExact } from "@/lib/format";
import { categoryLabel } from "@/components/games/provider-games-section";
import {
  useAsTechGames,
  useAsTechLogs,
  useAsTechStatus,
  useAsTechTransactions,
  useSyncGames,
  useTestConnection,
  useToggleGame,
  type ConnectionTest,
} from "@/hooks/use-provider-admin";

const TABS = ["Games", "Transactions", "Callback logs", "Request logs"] as const;
type Tab = (typeof TABS)[number];

const statusTone = { CONNECTED: "signal", ERROR: "crimson", DISCONNECTED: "neutral", NOT_TESTED: "gold" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/50 shrink-0">{label}</span>
      <span className="text-sm text-white text-right break-all">{children}</span>
    </div>
  );
}

function Flag({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return ok ? <Badge tone="signal"><CheckCircle2 className="h-3 w-3" />{yes}</Badge> : <Badge tone="crimson"><XCircle className="h-3 w-3" />{no}</Badge>;
}

function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</Button>
      <span className="text-xs text-white/50">{page} / {totalPages}</span>
      <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</Button>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: { key: string; label: string; render?: (v: unknown, row: Record<string, unknown>) => React.ReactNode }[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-white/40">{columns.map((c) => <th key={c.key} className="py-2 pr-4 font-medium whitespace-nowrap">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-t border-white/5 text-white/80">
              {columns.map((c) => <td key={c.key} className="py-2 pr-4 whitespace-nowrap">{c.render ? c.render(r[c.key], r) : String(r[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GamesTab() {
  const [f, setF] = useState({ page: 1, search: "", category: "", provider: "", enabled: "" });
  const { data, isLoading } = useAsTechGames(f);
  const toggle = useToggleGame();
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, page: 1, ...patch }));
  const select = "h-11 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Input placeholder="Search title or game ID" value={f.search} onChange={(e) => set({ search: e.target.value })} className="col-span-2 md:col-span-1" />
        <select className={select} value={f.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">All categories</option>
          {data?.facets.categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
        <select className={select} value={f.provider} onChange={(e) => set({ provider: e.target.value })}>
          <option value="">All studios</option>
          {data?.facets.providers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={select} value={f.enabled} onChange={(e) => set({ enabled: e.target.value })}>
          <option value="">Any status</option>
          <option value="1">Enabled</option>
          <option value="0">Disabled</option>
        </select>
      </div>
      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : data && data.games.length > 0 ? (
        <>
          <DataTable
            rows={data.games as unknown as Record<string, unknown>[]}
            columns={[
              { key: "title", label: "Game" },
              { key: "providerName", label: "Provider" },
              { key: "category", label: "Category", render: (v) => categoryLabel(String(v)) },
              { key: "providerGameId", label: "Game ID", render: (v) => <span className="font-mono">{String(v).slice(0, 12)}{String(v).length > 12 ? "…" : ""}</span> },
              { key: "currencies", label: "Currencies", render: (v) => <span className={cn((v as string[]).includes("INR") ? "text-signal" : "text-white/40")}>{(v as string[]).slice(0, 4).join(", ")}{(v as string[]).length > 4 ? ` +${(v as string[]).length - 4}` : ""}</span> },
              { key: "isAvailable", label: "Provider", render: (v) => (v ? <Badge tone="signal">Listed</Badge> : <Badge tone="neutral">Removed</Badge>) },
              { key: "isEnabled", label: "On XArena", render: (v, r) => (
                <Button size="sm" variant={v ? "secondary" : "outline"} disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: String(r.id), isEnabled: !v }, { onError: (e) => toast({ title: "Failed", description: e instanceof ApiClientError ? e.message : "", tone: "error" }) })}>
                  {v ? "Disable" : "Enable"}
                </Button>
              ) },
            ]}
          />
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(page) => setF((s) => ({ ...s, page }))} />
          <p className="text-[11px] text-white/35">{data.pagination.total} games · players only see games that are enabled, still listed by AS Tech, and playable in INR.</p>
        </>
      ) : <EmptyState icon={Plug} title="No games" description="Run “Sync games” after the credentials are set." />}
    </div>
  );
}

function TransactionsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useAsTechTransactions(page, status);
  return (
    <div className="space-y-3">
      <select className="h-11 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option><option value="APPLIED">Applied</option><option value="ROLLED_BACK">Rolled back</option>
      </select>
      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : data && data.transactions.length > 0 ? (
        <>
          <DataTable rows={data.transactions} columns={[
            { key: "createdAt", label: "Time", render: (v) => formatDateTime(String(v)) },
            { key: "username", label: "Player" },
            { key: "providerTransactionId", label: "Provider tx", render: (v) => <span className="font-mono">{String(v)}</span> },
            { key: "roundId", label: "Round" },
            { key: "betAmount", label: "Bet", render: (v) => formatPaiseExact(Number(v)) },
            { key: "winAmount", label: "Win", render: (v) => formatPaiseExact(Number(v)) },
            { key: "balanceAfter", label: "Balance after", render: (v) => (v == null ? "—" : formatPaiseExact(Number(v))) },
            { key: "status", label: "Status", render: (v) => <Badge tone={v === "APPLIED" ? "signal" : "neutral"}>{String(v)}</Badge> },
          ]} />
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      ) : <EmptyState icon={Plug} title="No provider transactions yet" />}
    </div>
  );
}

const OK_OUTCOMES = new Set(["BALANCE_OK", "APPLIED", "DUPLICATE", "ROLLBACK_ROLLED_BACK", "ROLLBACK_DUPLICATE", "ROLLBACK_TOMBSTONED", "IGNORED_ROLLED_BACK"]);

function LogsTab({ type }: { type: "callbacks" | "requests" }) {
  const [page, setPage] = useState(1);
  const [failedOnly, setFailedOnly] = useState(false);
  const { data, isLoading } = useAsTechLogs(type, page, failedOnly);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); setPage(1); }} /> Failures only
      </label>
      {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : data && data.logs.length > 0 ? (
        <>
          <DataTable rows={data.logs} columns={type === "callbacks" ? [
            { key: "createdAt", label: "Time", render: (v) => formatDateTime(String(v)) },
            { key: "method", label: "cmd" },
            { key: "providerTransactionId", label: "Transaction", render: (v) => <span className="font-mono">{String(v ?? "—")}</span> },
            { key: "signatureValid", label: "Signature", render: (v) => (v ? <Badge tone="signal">valid</Badge> : <Badge tone="crimson">invalid</Badge>) },
            { key: "outcome", label: "Outcome", render: (v) => <Badge tone={OK_OUTCOMES.has(String(v)) ? "signal" : "crimson"}>{String(v)}</Badge> },
            { key: "error", label: "Detail" },
          ] : [
            { key: "createdAt", label: "Time", render: (v) => formatDateTime(String(v)) },
            { key: "endpoint", label: "Endpoint", render: (v) => <span className="font-mono">{String(v)}</span> },
            { key: "ok", label: "Result", render: (v) => (v ? <Badge tone="signal">ok</Badge> : <Badge tone="crimson">failed</Badge>) },
            { key: "httpStatus", label: "HTTP" },
            { key: "errorKind", label: "Error" },
            { key: "attempts", label: "Attempts" },
            { key: "durationMs", label: "ms" },
            { key: "providerRequestId", label: "AS Tech request ID", render: (v) => <span className="font-mono">{String(v ?? "—")}</span> },
          ]} />
          <Pager page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
        </>
      ) : <EmptyState icon={Plug} title="Nothing logged yet" />}
    </div>
  );
}

export default function AdminProviderPage() {
  const { data: s, isLoading } = useAsTechStatus();
  const test = useTestConnection();
  const sync = useSyncGames();
  const [tab, setTab] = useState<Tab>("Games");
  const [result, setResult] = useState<ConnectionTest | null>(null);

  const runTest = () =>
    test.mutate(undefined, {
      onSuccess: (r) => { setResult(r); toast({ title: r.ok ? "Connection OK" : "Connection failed", description: r.ok ? `${r.currencyCount} currencies · INR ${r.inrSupported ? "available" : "NOT available"}` : r.error, tone: r.ok ? "success" : "error" }); },
      onError: (e) => toast({ title: "Test failed", description: e instanceof ApiClientError ? e.message : "", tone: "error" }),
    });
  const runSync = () =>
    sync.mutate(undefined, {
      onSuccess: () => toast({ title: "Catalogue synced", tone: "success" }),
      onError: (e) => toast({ title: "Sync failed", description: e instanceof ApiClientError ? e.message : "", tone: "error" }),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">Game Provider · AS Tech</h1>
        <div className="flex gap-2">
          <Button variant="secondary" loading={test.isPending} onClick={runTest}><Plug className="h-4 w-4" /> Test connection</Button>
          <Button loading={sync.isPending} onClick={runSync}><RefreshCw className="h-4 w-4" /> Sync games</Button>
        </div>
      </div>

      {isLoading || !s ? <Skeleton className="h-64 rounded-2xl" /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-white text-sm">Status</h2>
              <Badge tone={statusTone[s.status]}>{s.status.replace("_", " ")}</Badge>
            </div>
            <Row label="API base URL">{s.config.apiBaseUrl}</Row>
            <Row label="API key"><Flag ok={s.config.apiKeyConfigured} yes="configured" no="missing" /></Row>
            <Row label="Secret key"><Flag ok={s.config.secretConfigured} yes="configured" no="missing" /></Row>
            <Row label="Public app URL">{s.config.publicAppUrl ? <>{s.config.publicAppUrl} {!s.config.publicUrlIsHttps && <Badge tone="crimson">must be https</Badge>}</> : <Badge tone="crimson">APP_PUBLIC_URL not set</Badge>}</Row>
            <Row label="Callback URL">
              {s.config.callbackUrl ? (
                <button className="inline-flex items-center gap-1.5 hover:text-violet" onClick={() => { navigator.clipboard?.writeText(s.config.callbackUrl!); toast({ title: "Copied", tone: "success" }); }}>
                  {s.config.callbackUrl} <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : "—"}
            </Row>
            <Row label="Last provider request">{s.lastRequest ? `${s.lastRequest.ok ? "OK" : `Failed (${s.lastRequest.errorKind ?? s.lastRequest.httpStatus})`} · ${formatDateTime(s.lastRequest.createdAt)}` : "—"}</Row>
            <Row label="Last callback">{s.lastCallback ? `${s.lastCallback.outcome} · ${formatDateTime(s.lastCallback.createdAt)}` : "none received"}</Row>
            <Row label="Failures (24h)">{s.failedRequests24h} requests · {s.problemCallbacks24h} callbacks</Row>
            {result && (
              <div className={cn("mt-3 rounded-xl border p-3 text-xs", result.ok ? "border-signal/30 bg-signal/10 text-signal" : "border-crimson/30 bg-crimson/10 text-crimson")}>
                {result.ok ? `OK in ${result.durationMs}ms · ${result.currencyCount} currencies · INR ${result.inrSupported ? "available" : "not available"}` : `${result.errorKind}: ${result.error}`}
                {result.requestId && <div className="font-mono opacity-80 mt-1">request id {result.requestId}</div>}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-white text-sm mb-2">Catalogue</h2>
            <Row label="Games stored">{s.catalogue.total}</Row>
            <Row label="Enabled on XArena">{s.catalogue.enabled}</Row>
            <Row label="Currently listed by AS Tech">{s.catalogue.available}</Row>
            <Row label="INR available on account"><Flag ok={s.catalogue.inrAvailable} yes="yes" no="not seen" /></Row>
            <Row label="Last sync">
              {s.catalogue.lastSync ? <>{formatDateTime(s.catalogue.lastSync.at)} · {s.catalogue.lastSync.ok ? `+${s.catalogue.lastSync.created} new, ${s.catalogue.lastSync.updated} updated, ${s.catalogue.lastSync.markedUnavailable} removed` : <span className="text-crimson">{s.catalogue.lastSync.error}</span>}</> : "never"}
            </Row>
            <div className="mt-3 space-y-1">
              {s.notes.map((n) => <p key={n} className="text-[11px] text-white/40 leading-relaxed">{n}</p>)}
            </div>
          </Card>
        </div>
      )}

      <div>
        <div className="flex gap-2 overflow-x-auto mb-4">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("shrink-0 h-10 px-4 rounded-xl text-sm font-semibold border", tab === t ? "bg-violet/15 text-violet border-violet/40" : "bg-white/5 text-white/60 border-white/10")}>{t}</button>
          ))}
        </div>
        <Card className="p-4">
          {tab === "Games" && <GamesTab />}
          {tab === "Transactions" && <TransactionsTab />}
          {tab === "Callback logs" && <LogsTab type="callbacks" />}
          {tab === "Request logs" && <LogsTab type="requests" />}
        </Card>
      </div>
    </div>
  );
}
