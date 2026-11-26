"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, useRequestWithdraw, useBanks, useDeleteBank } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { WalletTabs } from "@/components/wallet/wallet-tabs";
import { BankCard, EmptyBankSlot } from "@/components/wallet/bank-cards";
import { AddBankForm } from "@/components/wallet/add-bank-form";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatPaise } from "@/lib/format";
import { ArrowLeft, IndianRupee, Info } from "lucide-react";

const MIN_WITHDRAW = 100;
const QUICK_AMOUNTS = [100, 500, 1000];

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
  const [confirming, setConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; slot: number } | null>(null);

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

  const selectedBank = banks.find((b) => b.id === selectedId) ?? null;
  const maxRupees = wallet ? Math.floor(wallet.winningBalance / 100) : 0;
  const belowMin = !!wallet && maxRupees < MIN_WITHDRAW;
  const amountError =
    amount === ""
      ? null
      : amount < MIN_WITHDRAW
        ? `Minimum withdrawal is ₹${MIN_WITHDRAW}`
        : wallet && amount > maxRupees
          ? `You can withdraw up to ₹${maxRupees.toLocaleString("en-IN")}`
          : null;
  const canWithdraw = !!wallet && !!selectedId && amount !== "" && !amountError && !belowMin;

  const handleWithdraw = () => {
    if (!selectedId || amount === "" || !canWithdraw) return;
    withdraw.mutate(
      { amountRupees: amount, bankId: selectedId },
      {
        onSuccess: () => {
          setConfirming(false);
          toast({ title: "Withdrawal requested", description: "It will be reviewed and processed shortly.", tone: "success" });
          router.push("/wallet");
        },
        onError: (err) => {
          setConfirming(false);
          toast({ title: "Couldn't submit request", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteBank.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast({ title: "Bank removed", tone: "success" });
      },
      onError: (err) => {
        setDeleteTarget(null);
        toast({ title: "Couldn't remove bank", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
      },
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
      <h1 className="text-xl font-black text-white">Withdraw Money</h1>
      <WalletTabs active="withdraw" />

      {wallet && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-sm text-white/50">Available to withdraw</span>
          <span className="font-mono font-bold text-signal">{formatPaise(wallet.winningBalance)}</span>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div>
          <label htmlFor="wd-amount" className="text-xs font-semibold text-white/60 mb-2 block">Amount</label>
          <div
            className={`flex items-center gap-2 bg-surface-2 rounded-2xl border px-4 h-14 focus-within:border-violet/60 ${
              amountError ? "border-crimson/60" : "border-white/10"
            }`}
          >
            <IndianRupee className="h-5 w-5 text-white/40 shrink-0" />
            <input
              id="wd-amount"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              aria-invalid={amountError ? true : undefined}
              aria-describedby="wd-amount-help"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 7);
                setAmount(v ? Number(v) : "");
              }}
              placeholder="0"
              className="min-w-0 flex-1 bg-transparent text-2xl font-black text-white outline-none font-mono placeholder:text-white/25"
            />
          </div>
          {amountError ? (
            <p id="wd-amount-help" role="alert" className="text-xs text-crimson mt-1.5">{amountError}</p>
          ) : belowMin ? (
            <p id="wd-amount-help" className="text-xs text-gold mt-1.5">
              You need at least ₹{MIN_WITHDRAW} in winnings to withdraw. Keep playing to build your winnings.
            </p>
          ) : (
            <p id="wd-amount-help" className="text-[11px] text-white/45 mt-1.5">
              Min ₹{MIN_WITHDRAW}
              {wallet ? ` · Max ₹${maxRupees.toLocaleString("en-IN")}` : ""}
            </p>
          )}

          {wallet && !belowMin && (
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_AMOUNTS.filter((a) => a < maxRupees).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={amount === a}
                  onClick={() => setAmount(a)}
                  className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt ${
                    amount === a ? "gradient-brand text-white border-transparent" : "bg-white/5 border-white/10 text-white/80"
                  }`}
                >
                  ₹{a.toLocaleString("en-IN")}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={amount === maxRupees}
                onClick={() => setAmount(maxRupees)}
                className={`h-10 px-4 rounded-xl text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt ${
                  amount === maxRupees ? "gradient-brand text-white border-transparent" : "bg-white/5 border-white/10 text-white/80"
                }`}
              >
                Max
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-3 rounded-xl bg-cobalt/10 border border-cobalt/20">
          <Info className="h-4 w-4 text-cobalt shrink-0 mt-0.5" />
          <p className="text-xs text-white/60">
            Only winnings can be withdrawn (not deposited or bonus balance). Withdrawals are reviewed by our team before processing.
          </p>
        </div>
      </Card>

      <div>
        <h2 className="text-base font-black text-white">Withdraw to</h2>
        <p className="text-xs text-white/55 mt-0.5">Check the bank details before you withdraw.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
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
              onDelete={() => setDeleteTarget({ id: b.id, slot: b.slot })}
              deleting={deleteBank.isPending && deleteBank.variables === b.id}
            />
          ))}
          {Array.from({ length: Math.max(0, maxBanks - banks.length) }).map((_, i) => (
            <EmptyBankSlot key={`empty-${i}`} onAdd={() => setAdding(true)} />
          ))}
        </div>
      )}

      <Button fullWidth size="lg" disabled={!canWithdraw} onClick={() => setConfirming(true)}>
          {!selectedId ? "Select a bank account" : "Request Withdrawal"}
        </Button>

      <Dialog open={confirming} onClose={() => !withdraw.isPending && setConfirming(false)} title="Confirm withdrawal">
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-2 border border-white/10 p-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-white/55">Amount</span>
              <span className="font-mono font-black text-white">₹{amount === "" ? 0 : amount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-white/55">To</span>
              <span className="text-right font-semibold text-white">
                {selectedBank ? `${selectedBank.bankName} ••••${selectedBank.accountNumber.slice(-4)}` : "—"}
              </span>
            </div>
            {selectedBank && (
              <div className="flex justify-between gap-3">
                <span className="text-white/55">Account holder</span>
                <span className="text-right font-semibold text-white">{selectedBank.accountHolder}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-white/55">Our team reviews every withdrawal before it is sent. You can&apos;t edit it after you submit.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" disabled={withdraw.isPending} onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="lg" loading={withdraw.isPending} onClick={handleWithdraw}>Confirm</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={deleteTarget !== null} onClose={() => !deleteBank.isPending && setDeleteTarget(null)} title={`Remove Bank ${deleteTarget?.slot ?? ""}?`}>
        <div className="space-y-4">
          <p className="text-sm text-white/70">You can add this bank account again later.</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" disabled={deleteBank.isPending} onClick={() => setDeleteTarget(null)}>Keep</Button>
            <Button variant="danger" size="lg" loading={deleteBank.isPending} onClick={handleDelete}>Remove</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
