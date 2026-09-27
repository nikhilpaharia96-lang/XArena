"use client";

import { useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useCreateDepositOrder, useVerifyDeposit } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { ArrowLeft, IndianRupee } from "lucide-react";
import Link from "next/link";

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function DepositPage() {
  useRequireAuth();
  const router = useRouter();
  const [amount, setAmount] = useState<number | "">("");
  const createOrder = useCreateDepositOrder();
  const verifyDeposit = useVerifyDeposit();
  const [scriptReady, setScriptReady] = useState(false);

  const handleDeposit = () => {
    if (!amount || amount < 10) {
      toast({ title: "Minimum deposit is ₹10", tone: "error" });
      return;
    }

    createOrder.mutate(amount, {
      onSuccess: (order) => {
        if (!scriptReady || !window.Razorpay) {
          toast({ title: "Payment gateway loading", description: "Please try again in a moment.", tone: "error" });
          return;
        }
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "XArena",
          description: "Wallet Deposit",
          theme: { color: "#7C5CF6" },
          handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            verifyDeposit.mutate(
              {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              {
                onSuccess: () => {
                  toast({ title: "Deposit successful!", description: `₹${amount} added to your wallet.`, tone: "success" });
                  router.push("/wallet");
                },
                onError: () => {
                  toast({ title: "Verification failed", description: "Contact support if money was deducted.", tone: "error" });
                },
              }
            );
          },
        });
        rzp.open();
      },
      onError: (err) => {
        if (err instanceof ApiClientError && err.code === "PAYMENTS_NOT_CONFIGURED") {
          toast({
            title: "Payments not set up yet",
            description: "The platform owner needs to add Razorpay API keys to enable deposits.",
            tone: "info",
          });
          return;
        }
        toast({ title: "Couldn't start payment", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
      },
    });
  };

  return (
    <div className="space-y-5">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setScriptReady(true)} />

      <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>
      <h1 className="text-xl font-black text-white">Add Money</h1>

      <Card className="p-5">
        <label className="text-xs font-semibold text-white/60 mb-2 block">Enter Amount</label>
        <div className="flex items-center gap-2 bg-surface-2 rounded-2xl border border-white/10 px-4 h-16 mb-4">
          <IndianRupee className="h-6 w-6 text-white/40" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
            placeholder="0"
            className="flex-1 bg-transparent text-3xl font-black text-white outline-none font-mono"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(a)}
              className="h-11 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white/80 hover:border-violet/40"
            >
              ₹{a}
            </button>
          ))}
        </div>

        <Button fullWidth size="lg" loading={createOrder.isPending || verifyDeposit.isPending} onClick={handleDeposit}>
          Proceed to Pay
        </Button>
        <p className="text-[11px] text-white/35 text-center mt-3">
          Secured by Razorpay · UPI, Cards, Netbanking supported
        </p>
      </Card>
    </div>
  );
}
