"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatPaiseExact } from "@/lib/format";
import { useQuickApprove, type QuickApproveOutcome, type QuickApproveResultRow } from "@/hooks/use-admin";

const LABEL: Record<QuickApproveOutcome, { text: string; cls: string }> = {
  APPROVED: { text: "Approved & credited", cls: "text-signal" },
  NOT_FOUND: { text: "No pending request with this UTR", cls: "text-crimson" },
  ALREADY_APPROVED: { text: "Already approved earlier (not credited again)", cls: "text-gold" },
  ALREADY_REJECTED: { text: "This request was rejected earlier (not approved)", cls: "text-crimson" },
  AMOUNT_MISMATCH: { text: "Amount does not match - NOT approved", cls: "text-crimson" },
  INVALID_UTR: { text: "UTR format is wrong (12-22 letters/numbers)", cls: "text-crimson" },
  INVALID_AMOUNT: { text: "Amount is not valid", cls: "text-crimson" },
};

export function QuickApprovePanel() {
  const [utr, setUtr] = useState("");
  const [amount, setAmount] = useState("");
  const [results, setResults] = useState<QuickApproveResultRow[]>([]);
  const mutation = useQuickApprove();

  const run = () => {
    if (mutation.isPending) return;
    if (!utr.trim() || !amount.trim()) {
      toast({ title: "UTR aur amount dono bharo", description: "Transaction UTR / reference no. aur received amount (₹) likhna zaroori hai.", tone: "error" });
      return;
    }
    mutation.mutate([{ utr: utr.trim(), amountRupees: amount.trim() }], {
      onSuccess: (d) => {
        const r = d.results[0];
        setResults((prev) => [r, ...prev].slice(0, 8));
        toast({ title: r.outcome === "APPROVED" ? "Deposit approved" : LABEL[r.outcome].text, tone: r.outcome === "APPROVED" ? "success" : "error" });
        if (r.outcome === "APPROVED") {
          setUtr("");
          setAmount("");
        }
      },
      onError: (e) => toast({ title: "Quick approve failed", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
    });
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") run();
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-gold" />
        <h2 className="font-black text-white">Quick approve by UTR</h2>
      </div>
      <p className="text-xs text-white/50">
        Bank / UPI statement se transaction UTR (reference no.) aur received amount likho. Pending request tabhi approve hogi aur wallet me paisa jayega
        jab UTR <b>aur</b> amount dono bilkul match karein.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="qa-utr" className="text-xs font-semibold text-white/60 mb-1.5 block">Transaction UPI / UTR / Reference No.</label>
          <Input id="qa-utr" value={utr} onChange={(e) => setUtr(e.target.value.slice(0, 40))} onKeyDown={onEnter} placeholder="e.g. 412345678901" spellCheck={false} autoComplete="off" className="font-mono" />
        </div>
        <div>
          <label htmlFor="qa-amount" className="text-xs font-semibold text-white/60 mb-1.5 block">Amount (₹)</label>
          <Input id="qa-amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,₹]/g, "").slice(0, 12))} onKeyDown={onEnter} inputMode="decimal" placeholder="e.g. 500" autoComplete="off" className="font-mono" />
        </div>
      </div>
      <Button fullWidth loading={mutation.isPending} onClick={run}>Match &amp; Approve</Button>

      {results.length > 0 && (
        <ul className="divide-y divide-white/5 rounded-xl bg-white/5">
          {results.map((r, i) => (
            <li key={`${r.utr}-${i}`} className="px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-white/80 break-all">{r.utr}</span>
                <span className={`font-bold text-right ${LABEL[r.outcome].cls}`}>{LABEL[r.outcome].text}</span>
              </div>
              {r.username && (
                <p className="text-white/50 mt-0.5">
                  {r.username} · request {r.requestAmount !== undefined ? formatPaiseExact(r.requestAmount) : ""}
                  {r.outcome === "AMOUNT_MISMATCH" && r.enteredAmount !== undefined ? ` · you entered ${formatPaiseExact(r.enteredAmount)}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
