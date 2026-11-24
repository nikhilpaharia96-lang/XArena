"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddBank, useRequestBankOtp } from "@/hooks/use-wallet";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { BANKS, IFSC_REGEX, OTHER_BANK, bankFromIfsc } from "@/lib/banks";

const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]{1,79}$/;

export function AddBankForm({ slot, onBack, onDone }: { slot: number; onBack: () => void; onDone: () => void }) {
  const requestOtp = useRequestBankOtp();
  const addBank = useAddBank();

  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [touched, setTouched] = useState(false);
  // Track whether the bank was auto-filled from the IFSC so we never overwrite a manual pick.
  const autoFilled = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.ifsc = IFSC_REGEX.test(ifsc) ? null : "Enter a valid 11-character IFSC (e.g. SBIN0001234)";
    const fromIfsc = IFSC_REGEX.test(ifsc) ? bankFromIfsc(ifsc) : null;
    e.bankName = !bankName
      ? "Select your bank"
      : fromIfsc && BANKS.some((b) => b.name === bankName) && fromIfsc !== bankName
        ? `This IFSC belongs to ${fromIfsc}`
        : null;
    e.accountNumber = /^\d{9,18}$/.test(accountNumber) ? null : "Account number must be 9–18 digits";
    e.holder = NAME_REGEX.test(holder.trim()) ? null : "Enter the name exactly as on the bank account";
    e.otp = /^\d{6}$/.test(otp) ? null : otpSent ? "Enter the 6-digit OTP" : "Request an OTP first";
    return e;
  }, [ifsc, bankName, accountNumber, holder, otp, otpSent]);

  const show = (k: string) => (touched ? errors[k] ?? undefined : undefined);
  const fieldsValid = !errors.ifsc && !errors.bankName && !errors.accountNumber && !errors.holder;

  const onIfscChange = (raw: string) => {
    const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    setIfsc(v);
    if (v.length >= 4) {
      const match = bankFromIfsc(v);
      if (match && (!bankName || autoFilled.current)) {
        setBankName(match);
        autoFilled.current = true;
      }
    }
  };

  const reset = () => {
    setIfsc("");
    setBankName("");
    setAccountNumber("");
    setHolder("");
    setOtp("");
    setTouched(false);
    autoFilled.current = false;
  };

  const sendOtp = () => {
    requestOtp.mutate(undefined, {
      onSuccess: (res) => {
        setOtpSent(true);
        setCooldown(res.resendInSec);
        toast({ title: "OTP sent", description: "Open Notifications to see your 6-digit code.", tone: "success" });
      },
      onError: (err) => {
        if (err instanceof ApiClientError && err.code === "OTP_COOLDOWN") setOtpSent(true);
        toast({ title: "Couldn't send OTP", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
      },
    });
  };

  const submit = () => {
    setTouched(true);
    if (!fieldsValid || errors.otp) return;
    addBank.mutate(
      { ifsc, bankName, accountNumber, accountHolder: holder.trim().replace(/\s+/g, " "), otp },
      {
        onSuccess: () => {
          toast({ title: "Bank account added", tone: "success" });
          onDone();
        },
        onError: (err) =>
          toast({ title: "Couldn't add bank", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" }),
      }
    );
  };

  const label = "text-sm font-semibold text-white mb-1.5 block";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[40px_1fr_40px] items-center">
        <button type="button" onClick={onBack} aria-label="Back" className="h-10 w-10 -ml-2 flex items-center justify-center text-white">
          <ChevronLeft className="h-7 w-7" strokeWidth={3} />
        </button>
        <h2 className="text-center text-lg font-black text-white">BANK {slot}</h2>
        <button type="button" onClick={reset} aria-label="Clear form" className="h-10 w-10 flex items-center justify-center text-white/70">
          <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] p-4 space-y-4">
        <div>
          <label className={label} htmlFor="ifsc">IFSC/SWIFT</label>
          <Input id="ifsc" value={ifsc} onChange={(e) => onIfscChange(e.target.value)} placeholder="Enter IFSC/SWIFT" autoCapitalize="characters" autoComplete="off" maxLength={11} error={show("ifsc")} />
        </div>

        <div>
          <label className={label} htmlFor="bank">Bank Name</label>
          <div className="relative">
            <select
              id="bank"
              value={bankName}
              onChange={(e) => {
                autoFilled.current = false;
                setBankName(e.target.value);
              }}
              className="w-full appearance-none rounded-xl bg-surface-2 border border-white/10 px-4 pr-10 h-12 text-sm text-white outline-none focus:border-violet/60 focus:ring-2 focus:ring-violet/20"
            >
              <option value="">Select One</option>
              {BANKS.map((b) => (
                <option key={b.prefix} value={b.name}>{b.name}</option>
              ))}
              <option value={OTHER_BANK}>{OTHER_BANK}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
          </div>
          {show("bankName") && <p className="mt-1.5 text-xs text-crimson">{show("bankName")}</p>}
        </div>

        <div>
          <label className={label} htmlFor="acct">Account No</label>
          <Input id="acct" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 18))} placeholder="Enter Account No" inputMode="numeric" autoComplete="off" error={show("accountNumber")} />
        </div>

        <div>
          <label className={label} htmlFor="holder">Account Holder Name</label>
          <Input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="Enter Account holder Name" autoComplete="off" maxLength={80} error={show("holder")} />
        </div>

        <div>
          <label className={label} htmlFor="otp">Enter OTP</label>
          <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Enter OTP" inputMode="numeric" autoComplete="one-time-code" disabled={!otpSent} className="disabled:opacity-60" error={otpSent ? show("otp") : undefined} />
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={sendOtp}
              disabled={requestOtp.isPending || cooldown > 0}
              className="h-9 px-3 rounded-lg border border-white/60 text-white text-sm font-semibold disabled:opacity-50"
            >
              {requestOtp.isPending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : otpSent ? "Resend OTP" : "Request OTP"}
            </button>
            {otpSent && (
              <Link href="/notifications" className="text-xs text-cobalt underline underline-offset-2">
                View OTP in Notifications
              </Link>
            )}
          </div>
          {touched && !otpSent && <p className="mt-1.5 text-xs text-crimson">Request an OTP first</p>}
        </div>

        <Button fullWidth size="lg" variant="cta" loading={addBank.isPending} onClick={submit}>
          ADD BANK
        </Button>
      </div>
    </div>
  );
}
