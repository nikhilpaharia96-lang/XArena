"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, useRequestWithdraw, useBanks, useDeleteBank } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { WalletTabs } from "@/components/wallet/wallet-tabs";
import { BankCard, EmptyBankSlot } from "@/components/wallet/bank-cards";
import { AddBankForm } from "@/components/wallet/add-bank-form";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatPaise } from "@/lib/format";
import { ArrowLeft, IndianRupee, Info } from "lucide-react";

export default function WithdrawPage() {
  useRequireAuth();
  const router = useRouter();
  const { data: wallet } = useWallet();
  const { data: bankData, isLoading, isError, refetch } = useBanks();
  const withdraw = useRequestWithdraw();
  const deleteBank = useDeleteBank();

  const [amount, setAmount] = useState<number | "">("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const banks = bankData?.banks ?? [];
  const maxBanks = bankData?.maxBanks ?? 3;

  // Derived selection: the user's pick if it still exists, otherwise the first saved bank.
  const selectedId = banks.some((b) => b.id === pickedId) ? pickedId : (banks[0]?.id ?? null);

  const nextSlot = (() => {
    const used = new Set(banks.map((b) => b.slot));
    let s = 1;
    while (used.has(s)) s++;
    return s;
  })();

  const handleWithdraw = () => {
    if (!selectedId) {
      toast({ title: "Select a bank account", tone: "error" });
      return;
    }
    if (!amount || amount < 100) {
      toast({ title: "Minimum withdrawal is ₹100", tone: "error" });
      return;
    }
    if (wallet && amount * 100 > wallet.winningBalance) {
      toast({ title: "Amount exceeds your winnings", tone: "error" });
      return;
    }
    withdraw.mutate(
      { amountRupees: amount, bankId: selectedId },
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

  const handleDelete = (id: string, slot: number) => {
    if (!window.confirm(`Remove Bank ${slot}? You can add it again later.`)) return;
    deleteBank.mutate(id, {
      onSuccess: () => toast({ title: "Bank removed", tone: "success" }),
      onError: (err) => toast({ title: "Couldn't remove bank", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" }),
    });
  };

  if (adding) {
    return (
      <div className="space-y-4">
        <AddBankForm
          slot={nextSlot}
          onBack={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-white/50 w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>
      <WalletTabs active="withdraw" />

      {wallet && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-white/50">Available to withdraw</span>
          <span className="font-mono font-bold text-signal">{formatPaise(wallet.winningBalance)}</span>
        </Card>
      )}

      <p className="text-center text-xs font-medium text-white/70 rounded-lg bg-white/5 py-2 px-3">
        Check the bank details before making a withdrawal
      </p>

      <h2 className="text-center text-lg font-black text-white">Choose a bank to Withdraw into</h2>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
      ) : isError ? (
        <ErrorState message="Couldn't load your bank accounts." onRetry={() => refetch()} />
      ) : (
        <div role="radiogroup" aria-label="Bank accounts" className="space-y-3">
          {banks.map((b) => (
            <BankCard
              key={b.id}
              bank={b}
              selected={b.id === selectedId}
              onSelect={() => setPickedId(b.id)}
              onDelete={() => handleDelete(b.id, b.slot)}
              deleting={deleteBank.isPending && deleteBank.variables === b.id}
            />
          ))}
          {Array.from({ length: Math.max(0, maxBanks - banks.length) }).map((_, i) => (
            <EmptyBankSlot key={`empty-${i}`} onAdd={() => setAdding(true)} />
          ))}
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 mb-2 block">Amount</label>
          <div className="flex items-center gap-2 bg-surface-2 rounded-2xl border border-white/10 px-4 h-14">
            <IndianRupee className="h-5 w-5 text-white/40" />
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
              placeholder="0"
              className="flex-1 bg-transparent text-2xl font-black text-white outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex gap-2 p-3 rounded-xl bg-cobalt/10 border border-cobalt/20">
          <Info className="h-4 w-4 text-cobalt shrink-0 mt-0.5" />
          <p className="text-xs text-white/60">
            Only winnings can be withdrawn (not deposited or bonus balance). Withdrawals are reviewed by our team before processing.
          </p>
        </div>

        <Button fullWidth size="lg" loading={withdraw.isPending} disabled={!selectedId} onClick={handleWithdraw}>
          Request Withdrawal
        </Button>
      </Card>
    </div>
  );
}
