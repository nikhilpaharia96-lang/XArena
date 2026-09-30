"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Copy, Download, Eye, ImagePlus, IndianRupee, Loader2, QrCode, ShieldCheck, X } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useWallet, usePaymentInfo, useSubmitDepositRequest } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { formatPaiseExact } from "@/lib/format";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];
const MAX_FILE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Step = "amount" | "pay" | "details" | "done";

export default function DepositPage() {
  useRequireAuth();
  const { data: wallet } = useWallet();
  const { data: info, isLoading, isError, refetch } = usePaymentInfo();
  const submit = useSubmitDepositRequest();

  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<number | "">("");
  const [utr, setUtr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const inflight = useRef(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const min = info?.minDepositRupees ?? 50;
  const max = info?.maxDepositRupees ?? 10000;
  const amountError = useMemo(() => {
    if (amount === "") return "Enter an amount";
    if (amount < min) return `Minimum deposit is ₹${min}`;
    if (amount > max) return `Maximum deposit is ₹${max.toLocaleString("en-IN")}`;
    return null;
  }, [amount, min, max]);

  const utrClean = utr.replace(/\s+/g, "").toUpperCase();
  const utrError = !utrClean ? "UTR is required" : !/^[A-Z0-9]{12,22}$/.test(utrClean) ? "UTR must be 12–22 letters/numbers" : null;
  const fileError = !file ? "Payment screenshot is required" : null;

  const copyUpi = async () => {
    if (!info?.upiId) return;
    try {
      await navigator.clipboard.writeText(info.upiId);
      setCopied(true);
      toast({ title: "UPI ID copied", tone: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Long-press the UPI ID to copy it.", tone: "error" });
    }
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) return toast({ title: "Unsupported file", description: "Use a JPG, PNG or WebP image.", tone: "error" });
    if (f.size > MAX_FILE) return toast({ title: "Image too large", description: "Maximum size is 5 MB.", tone: "error" });
    setFile(f);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (utrError || fileError || amountError || amount === "" || !file) return;
    if (inflight.current) return; // hard guard against double taps
    inflight.current = true;
    submit.mutate(
      { amountRupees: amount, utr: utrClean, screenshot: file },
      {
        onSuccess: (res) => {
          setSubmittedCode(res.code);
          setStep("done");
          toast({ title: "Payment request submitted", tone: "success" });
        },
        onError: (err) =>
          toast({ title: "Couldn't submit", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" }),
        onSettled: () => {
          inflight.current = false;
        },
      }
    );
  };

  const header = (
    <>
      <Link href="/wallet" className="flex items-center gap-1.5 text-sm text-white/50 w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Wallet
      </Link>
      <h1 className="text-xl font-black text-white">Add Money</h1>
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }
  if (isError || !info) {
    return (
      <div className="space-y-4">
        {header}
        <ErrorState message="Couldn't load payment details." onRetry={() => refetch()} />
      </div>
    );
  }
  if (!info.depositEnabled || !info.configured) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="p-6 text-center">
          <QrCode className="h-8 w-8 text-white/30 mx-auto mb-3" />
          <p className="font-semibold text-white">Deposits are temporarily unavailable</p>
          <p className="text-sm text-white/50 mt-1">Please check back soon.</p>
        </Card>
      </div>
    );
  }

  const steps: Step[] = ["amount", "pay", "details"];
  const stepIdx = steps.indexOf(step);
  const instructions = info.instructions.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <div className="space-y-5 max-w-lg mx-auto w-full">
      {header}

      {step !== "done" && (
        <div className="flex items-center gap-2" aria-label={`Step ${stepIdx + 1} of 3`}>
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= stepIdx ? "gradient-brand" : "bg-white/10"}`} />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "amount" && (
          <motion.div key="amount" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card className="p-4 flex items-center justify-between glow-border">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Current Balance</p>
                <p className="text-2xl font-black font-mono text-white">{wallet ? formatPaiseExact(wallet.totalBalance) : "—"}</p>
              </div>
              <div className="h-11 w-11 rounded-2xl gradient-brand flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-white" />
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-xs font-semibold text-white/60 mb-3">Quick Amount</p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {QUICK_AMOUNTS.filter((a) => a >= min && a <= max).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`h-11 rounded-xl text-sm font-semibold border transition-colors ${
                      amount === a ? "gradient-brand text-white border-transparent" : "bg-white/5 border-white/10 text-white/80"
                    }`}
                  >
                    ₹{a.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              <label htmlFor="amt" className="text-xs font-semibold text-white/60 mb-2 block">Custom Amount</label>
              <div className="flex items-center gap-2 bg-surface-2 rounded-2xl border border-white/10 px-4 h-14 focus-within:border-violet/60">
                <IndianRupee className="h-5 w-5 text-white/40 shrink-0" />
                <input
                  id="amt"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 7);
                    setAmount(v ? Number(v) : "");
                  }}
                  placeholder="Enter amount"
                  className="min-w-0 flex-1 bg-transparent text-xl font-black text-white outline-none font-mono placeholder:text-white/25 placeholder:font-normal placeholder:text-base"
                />
              </div>
              {amount !== "" && amountError ? (
                <p className="text-xs text-crimson mt-1.5">{amountError}</p>
              ) : (
                <p className="text-[11px] text-white/35 mt-1.5">Min ₹{min} · Max ₹{max.toLocaleString("en-IN")}</p>
              )}

              {amount !== "" && !amountError && (
                <p className="text-center text-sm text-white/70 mt-4">
                  You will pay <span className="font-black text-white">₹{amount.toLocaleString("en-IN")}</span>
                </p>
              )}
              <Button fullWidth size="lg" className="mt-4" disabled={amountError !== null} onClick={() => setStep("pay")}>
                Proceed to Payment
              </Button>
            </Card>
          </motion.div>
        )}

        {step === "pay" && amount !== "" && (
          <motion.div key="pay" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card className="p-5 glow-border text-center">
              <p className="text-[11px] uppercase tracking-wider text-white/50 font-semibold">Pay via UPI</p>
              <p className="text-3xl font-black font-mono text-white mt-1">₹{amount.toLocaleString("en-IN")}</p>

              {info.hasQr && (
                <div className="mt-4">
                  <div className="mx-auto w-full max-w-[220px] aspect-square rounded-2xl bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/api/payment-settings/qr" alt="Payment QR code" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex gap-2 justify-center mt-3">
                    <Button size="sm" variant="secondary" onClick={() => setShowQr(true)}><Eye className="h-4 w-4" /> View QR</Button>
                    <a
                      href="/api/payment-settings/qr?download=1"
                      className="inline-flex items-center justify-center gap-2 h-9 px-3 text-sm font-semibold rounded-xl bg-surface-2 text-white border border-white/10"
                    >
                      <Download className="h-4 w-4" /> Download QR
                    </a>
                  </div>
                </div>
              )}

              {info.upiId && (
                <div className="mt-4 rounded-2xl bg-surface-2 border border-white/10 p-3 text-left">
                  <p className="text-[11px] text-white/40">UPI ID{info.accountName ? ` · ${info.accountName}` : ""}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="flex-1 min-w-0 font-mono font-bold text-white break-all">{info.upiId}</p>
                    <Button size="sm" variant="outline" onClick={copyUpi}>
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <p className="text-sm font-bold text-white mb-3">Instructions</p>
              <ol className="space-y-2">
                {instructions.map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/70">
                    <span className="h-5 w-5 shrink-0 rounded-full bg-violet/20 text-violet text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="min-w-0 break-words">{line}</span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-gold mt-4">Pay the exact amount — your wallet is credited only after admin verification.</p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setStep("amount")}>Back</Button>
              <Button variant="cta" size="lg" onClick={() => setStep("details")}>I&apos;ve Paid</Button>
            </div>
          </motion.div>
        )}

        {step === "details" && amount !== "" && (
          <motion.div key="details" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="p-5 space-y-5">
              <div>
                <p className="text-sm font-bold text-white">Payment Details</p>
                <p className="text-xs text-white/50 mt-0.5">Amount Paid</p>
                <p className="text-2xl font-black font-mono text-white">₹{amount.toLocaleString("en-IN")}</p>
              </div>

              <div>
                <label htmlFor="utr" className="text-xs font-semibold text-white/60 mb-2 block">UTR / Transaction ID</label>
                <Input
                  id="utr"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 26))}
                  placeholder="Enter UTR number"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-mono"
                  error={touched ? utrError ?? undefined : undefined}
                />
                <p className="text-[11px] text-white/35 mt-1.5">Usually a 12-digit number shown in your UPI app after payment.</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-white/60 mb-2">Payment Screenshot</p>
                {preview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Payment screenshot preview" className="w-full max-h-72 object-contain" />
                    <button
                      onClick={() => setFile(null)}
                      aria-label="Remove screenshot"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/70 flex items-center justify-center text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex flex-col items-center justify-center gap-2 h-32 rounded-2xl border border-dashed cursor-pointer bg-white/[0.02] ${
                      touched && fileError ? "border-crimson/60" : "border-white/20"
                    }`}
                  >
                    <ImagePlus className="h-6 w-6 text-white/40" />
                    <span className="text-sm text-white/60">Upload Screenshot</span>
                    <span className="text-[11px] text-white/30">JPG, PNG or WebP · max 5 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => {
                        pickFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
                {touched && fileError && <p className="text-xs text-crimson mt-1.5">{fileError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" size="lg" disabled={submit.isPending} onClick={() => setStep("pay")}>Back</Button>
                <Button size="lg" loading={submit.isPending} onClick={handleSubmit}>Submit</Button>
              </div>
              <p className="text-[11px] text-white/35 text-center flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Reviewed manually by XArena admins
              </p>
            </Card>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="p-8 text-center glow-border">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12, stiffness: 200 }}
                className="h-16 w-16 rounded-full bg-signal/15 flex items-center justify-center mx-auto"
              >
                <CheckCircle2 className="h-9 w-9 text-signal" />
              </motion.div>
              <h2 className="text-lg font-black text-white mt-4">Payment Request Submitted</h2>
              <p className="text-sm text-white/60 mt-2">Your deposit is pending admin verification. Your wallet will be credited once it&apos;s approved.</p>
              {submittedCode && <p className="text-xs font-mono text-white/40 mt-3">Request #{submittedCode}</p>}
              <Link href="/wallet" className="block mt-6">
                <Button fullWidth size="lg">Back to Wallet</Button>
              </Link>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showQr} onClose={() => setShowQr(false)} title="Scan to Pay">
        <div className="rounded-2xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/payment-settings/qr" alt="Payment QR code" className="w-full object-contain" />
        </div>
      </Dialog>
      {submit.isPending && <Loader2 className="sr-only" />}
    </div>
  );
}
