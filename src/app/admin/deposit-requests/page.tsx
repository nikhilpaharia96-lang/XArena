"use client";
import { useRef, useState } from "react";
import { CheckCircle2, Eye, Inbox, X, Check } from "lucide-react";
import { useAdminDepositRequests, useDepositRequestAction, type AdminDepositRequestRow } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { formatPaiseExact, formatDateTimeFull } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";

type Tab = "PENDING" | "APPROVED" | "REJECTED";
const TABS: Tab[] = ["PENDING", "APPROVED", "REJECTED"];
const tone = { PENDING: "gold", APPROVED: "signal", REJECTED: "crimson" } as const;

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className={`text-sm text-white break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function ReviewDialogs({ row, onClose }: { row: AdminDepositRequestRow; onClose: () => void }) {
  const [mode, setMode] = useState<"view" | "approve" | "reject" | "success">("view");
  const [reason, setReason] = useState("");
  const approve = useDepositRequestAction(row.id, "approve");
  const reject = useDepositRequestAction(row.id, "reject");
  const busy = useRef(false); // synchronous guard — state updates are async, taps aren't

  const err = (e: unknown) => toast({ title: "Action failed", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" });

  const doApprove = () => {
    if (busy.current) return;
    busy.current = true;
    approve.mutate(undefined, {
      onSuccess: () => setMode("success"),
      onError: (e) => { err(e); setMode("view"); },
      onSettled: () => { busy.current = false; },
    });
  };
  const doReject = () => {
    if (busy.current) return;
    busy.current = true;
    reject.mutate({ reason: reason.trim() || undefined }, {
      onSuccess: () => { toast({ title: "Deposit rejected", tone: "success" }); onClose(); },
      onError: err,
      onSettled: () => { busy.current = false; },
    });
  };

  const title = mode === "approve" ? "Approve Deposit?" : mode === "reject" ? "Reject Deposit" : mode === "success" ? "Deposit Approved" : `Deposit Request #${row.code ?? row.id.slice(-6)}`;
  return (
    <Dialog open onClose={onClose} title={title}>
      {mode === "view" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Detail label="User" value={row.username} />
            <Detail label="Amount" value={formatPaiseExact(row.amount)} mono />
            <Detail label="UTR" value={row.utr} mono />
            <Detail label="Payment Method" value={row.paymentMethod} />
            <Detail label="Submitted" value={formatDateTimeFull(row.createdAt)} />
            <Detail label="Status" value={<Badge tone={tone[row.status]}>{row.status}</Badge>} />
          </div>
          {row.adminNote && <Detail label="Admin note" value={row.adminNote} />}
          <div>
            <p className="text-[11px] text-white/40 mb-1.5">Payment Screenshot</p>
            <a href={`/api/wallet/deposits/${row.id}/screenshot`} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/wallet/deposits/${row.id}/screenshot`} alt="Payment screenshot" className="w-full max-h-96 object-contain rounded-xl border border-white/10 bg-black/30" />
            </a>
          </div>
          {row.status === "PENDING" && (
            <div className="space-y-2">
              <Button fullWidth size="lg" onClick={() => setMode("approve")}>APPROVE — CREDIT WALLET</Button>
              <Button fullWidth variant="danger" onClick={() => setMode("reject")}>REJECT</Button>
            </div>
          )}
        </div>
      )}

      {mode === "approve" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/5 p-4">
            <Detail label="Amount" value={formatPaiseExact(row.amount)} mono />
            <Detail label="User" value={row.username} />
            <Detail label="UTR" value={row.utr} mono />
          </div>
          <p className="text-sm text-white/70">Wallet will be credited with <b className="text-white">{formatPaiseExact(row.amount)}</b>. This can&apos;t be undone.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={approve.isPending} onClick={() => setMode("view")}>Cancel</Button>
            <Button loading={approve.isPending} onClick={doApprove}>Confirm &amp; Credit</Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="space-y-4">
          <div>
            <label htmlFor="reason" className="text-xs font-semibold text-white/60 mb-2 block">Reason</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="e.g. Invalid payment reference"
              className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={reject.isPending} onClick={() => setMode("view")}>Cancel</Button>
            <Button variant="danger" loading={reject.isPending} onClick={doReject}>Confirm Rejection</Button>
          </div>
        </div>
      )}

      {mode === "success" && (
        <div className="text-center py-4">
          <div className="h-16 w-16 rounded-full bg-signal/15 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-9 w-9 text-signal" />
          </div>
          <p className="text-white font-bold mt-4">✓ Deposit Approved</p>
          <p className="text-sm text-white/60 mt-1">{formatPaiseExact(row.amount)} credited to wallet.</p>
          <Button fullWidth className="mt-5" onClick={onClose}>Done</Button>
        </div>
      )}
    </Dialog>
  );
}

export default function AdminDepositRequestsPage() {
  const [tab, setTab] = useState<Tab>("PENDING");
  const [selected, setSelected] = useState<AdminDepositRequestRow | null>(null);
  const { data, isLoading, isError, refetch } = useAdminDepositRequests(tab);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Deposit Requests</h1>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3.5 h-9 rounded-full text-xs font-semibold border whitespace-nowrap ${tab === t ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"}`}
          >
            {t[0] + t.slice(1).toLowerCase()} {data?.counts?.[t] !== undefined && <span className="opacity-70">({data.counts[t]})</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data && data.requests.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-white/40 border-b border-white/8">
                  {["ID", "User", "Amount", "UTR", "Method", "Screenshot", "Date", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.requests.map((r) => (
                  <tr key={r.id} className="text-white/80">
                    <td className="px-4 py-3 font-mono text-xs">#{r.code}</td>
                    <td className="px-4 py-3">{r.username}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{formatPaiseExact(r.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.utr}</td>
                    <td className="px-4 py-3">{r.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <a href={`/api/wallet/deposits/${r.id}/screenshot`} target="_blank" rel="noreferrer" className="text-violet text-xs font-semibold">Open</a>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTimeFull(r.createdAt)}</td>
                    <td className="px-4 py-3"><Badge tone={tone[r.status]}>{r.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setSelected(r)}><Eye className="h-3.5 w-3.5" /> View</Button>
                        {r.status === "PENDING" && (
                          <Button size="sm" onClick={() => setSelected(r)}><Check className="h-3.5 w-3.5" /> Review</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {data.requests.map((r) => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white/40">#{r.code}</p>
                    <p className="text-sm font-semibold text-white truncate">{r.username}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-white">{formatPaiseExact(r.amount)}</p>
                    <Badge tone={tone[r.status]}>{r.status}</Badge>
                  </div>
                </div>
                <p className="text-xs text-white/50 font-mono break-all">UTR {r.utr}</p>
                <p className="text-[11px] text-white/30">{r.paymentMethod} · {formatDateTimeFull(r.createdAt)}</p>
                <Button fullWidth size="sm" variant={r.status === "PENDING" ? "primary" : "secondary"} onClick={() => setSelected(r)}>
                  {r.status === "PENDING" ? "View & Review" : "View"}
                </Button>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={tab === "PENDING" ? Inbox : X} title={`No ${tab.toLowerCase()} deposit requests`} />
      )}

      {selected && <ReviewDialogs key={selected.id} row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
