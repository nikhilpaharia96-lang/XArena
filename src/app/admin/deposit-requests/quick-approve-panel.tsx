"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
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

/** One entry per line: "UTR amount" (separated by space, comma or tab). */
function parse(text: string): { entries: { utr: string; amountRupees: string }[]; bad: number[] } {
  const entries: { utr: string; amountRupees: string }[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const parts = line.trim().split(/[\s,|;\t]+/).filter(Boolean);
    if (parts.length < 2) return void bad.push(i + 1);
    entries.push({ utr: parts[0], amountRupees: parts.slice(1).join("") });
  });
  return { entries, bad };
}

export function QuickApprovePanel() {
  const [text, setText] = useState("");
  const [results, setResults] = useState<QuickApproveResultRow[] | null>(null);
  const mutation = useQuickApprove();

  const run = () => {
    if (mutation.isPending) return;
    const { entries, bad } = parse(text);
    if (bad.length) {
      toast({ title: "Amount missing", description: `Line ${bad.join(", ")}: write UTR and the amount received, e.g. 412345678901 500`, tone: "error" });
      return;
    }
    if (entries.length === 0) {
      toast({ title: "Nothing to approve", description: "Enter at least one UTR and amount.", tone: "error" });
      return;
    }
    mutation.mutate(entries, {
      onSuccess: (d) => {
        setResults(d.results);
        toast({ title: d.approved > 0 ? `${d.approved} deposit(s) approved` : "No deposit approved", tone: d.approved > 0 ? "success" : "info" });
        // keep only the lines that still need attention
        const left = d.results.filter((r) => r.outcome !== "APPROVED").map((r) => r.utr);
        setText(entries.filter((e) => left.includes(e.utr.replace(/\s+/g, "").toUpperCase())).map((e) => `${e.utr} ${e.amountRupees}`).join("\n"));
      },
      onError: (e) => toast({ title: "Quick approve failed", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
    });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-gold" />
        <h2 className="font-black text-white">Quick approve by UTR</h2>
      </div>
      <p className="text-xs text-white/50">
        Copy the UTR and the amount from your bank / UPI statement, one payment per line (e.g. <span className="font-mono">412345678901 500</span>).
        A pending request is approved and the wallet credited <b>only</b> if the UTR and the amount both match exactly.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 6000))}
        rows={3}
        spellCheck={false}
        placeholder={"412345678901 500\n509876543210 1,000"}
        className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm font-mono text-white placeholder:text-white/30 outline-none focus:border-violet/60"
      />
      <Button fullWidth loading={mutation.isPending} onClick={run}>Match &amp; Approve</Button>

      {results && results.length > 0 && (
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
