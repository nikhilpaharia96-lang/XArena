"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, useRequestWithdraw } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatPaise } from "@/lib/format";
import { ArrowLeft, IndianRupee, Info } from "lucide-react";

export default function WithdrawPage() {
  useRequireAuth();
  const router = useRouter();
  const { data: wallet } = useWallet();
  const [amount, setAmount] = useState<number | "">("");
  const [upiId, setUpiId] = useState("");
  const withdraw = useRequestWithdraw();

  const handleWithdraw = () => {
    if (!amount || amount < 100) {
      toast({ title: "Minimum withdrawal is ₹100", tone: "error" });
      return;
    }
    if (!upiId || !upiId.includes("@")) {
      toast({ title: "Enter a valid UPI ID", tone: "error" });
      return;
    }

    withdraw.mutate(
      { amountRupees: amount, upiId },
      {
        onSuccess: () => {
          toast({ title: "Withdrawal requested", description: "It will be reviewed and processed shortly.", tone: "success" });
          router.push("/wallet");
        },
        onError: (err) => {
          toast({ title: "Couldn't submit request", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>
      <h1 className="text-xl font-black text-white">Withdraw</h1>

      {wallet && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-white/50">Available to withdraw</span>
          <span className="font-mono font-bold text-signal">{formatPaise(wallet.winningBalance)}</span>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 mb-2 block">Amount</label>
          <div className="flex items-center gap-2 bg-surface-2 rounded-2xl border border-white/10 px-4 h-14">
            <IndianRupee className="h-5 w-5 text-white/40" />
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              placeholder="0"
              className="flex-1 bg-transparent text-2xl font-black text-white outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">UPI ID</label>
          <Input placeholder="yourname@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
        </div>

        <div className="flex gap-2 p-3 rounded-xl bg-cobalt/10 border border-cobalt/20">
          <Info className="h-4 w-4 text-cobalt shrink-0 mt-0.5" />
          <p className="text-xs text-white/60">
            Only winnings can be withdrawn (not deposited or bonus balance). Withdrawals are reviewed by our team before processing.
          </p>
        </div>

        <Button fullWidth size="lg" loading={withdraw.isPending} onClick={handleWithdraw}>
          Request Withdrawal
        </Button>
      </Card>
    </div>
  );
}
