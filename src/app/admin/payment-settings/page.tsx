"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, QrCode, Trash2 } from "lucide-react";
import { useAdminPaymentSettings, useSavePaymentSettings, type AdminPaymentSettings } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/60 mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function PaymentSettingsForm({ data }: { data: AdminPaymentSettings }) {
  const save = useSavePaymentSettings();
  const inflight = useRef(false);

  const [upiId, setUpiId] = useState(data.upiId);
  const [accountName, setAccountName] = useState(data.accountName);
  const [instructions, setInstructions] = useState(data.instructions);
  const [min, setMin] = useState(String(data.minDepositRupees));
  const [max, setMax] = useState(String(data.maxDepositRupees));
  const [enabled, setEnabled] = useState(data.depositEnabled);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [qrVersion, setQrVersion] = useState(0);

  const qrPreview = useMemo(() => (qrFile ? URL.createObjectURL(qrFile) : null), [qrFile]);
  useEffect(() => {
    return () => {
      if (qrPreview) URL.revokeObjectURL(qrPreview);
    };
  }, [qrPreview]);

  const currentQr = qrPreview ?? (data.hasQr && !removeQr ? `/api/payment-settings/qr?v=${qrVersion}` : null);

  const onSave = () => {
    if (inflight.current) return;
    inflight.current = true;
    const form = new FormData();
    form.set("upiId", upiId.trim());
    form.set("accountName", accountName.trim());
    form.set("instructions", instructions);
    form.set("minDepositRupees", min);
    form.set("maxDepositRupees", max);
    form.set("depositEnabled", String(enabled));
    form.set("removeQr", String(removeQr));
    if (qrFile) form.set("qr", qrFile);
    save.mutate(form, {
      onSuccess: () => {
        toast({ title: "Payment settings saved", tone: "success" });
        setQrFile(null);
        setRemoveQr(false);
        setQrVersion((v) => v + 1);
      },
      onError: (e) => toast({ title: "Couldn't save", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
      onSettled: () => { inflight.current = false; },
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-black text-white">Payment Settings</h1>
      <Card className="p-5 space-y-5">
        <Field label="UPI ID"><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" autoComplete="off" /></Field>
        <Field label="Account Holder Name"><Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="XArena Esports" /></Field>

        <Field label="QR Code">
          <div className="flex items-start gap-4">
            <div className="h-32 w-32 shrink-0 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
              {currentQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentQr} alt="Payment QR" className="h-full w-full object-contain bg-white" />
              ) : (
                <QrCode className="h-8 w-8 text-white/25" />
              )}
            </div>
            <div className="space-y-2 min-w-0">
              <label className="inline-flex items-center gap-2 h-9 px-3 text-sm font-semibold rounded-xl bg-surface-2 text-white border border-white/10 cursor-pointer">
                <ImagePlus className="h-4 w-4" /> Upload QR
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 2 * 1024 * 1024) toast({ title: "QR image must be under 2 MB", tone: "error" });
                    else if (f) { setQrFile(f); setRemoveQr(false); }
                    e.target.value = "";
                  }}
                />
              </label>
              {(data.hasQr || qrFile) && (
                <button className="flex items-center gap-1.5 text-xs text-crimson" onClick={() => { setQrFile(null); setRemoveQr(true); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Remove QR
                </button>
              )}
              <p className="text-[11px] text-white/35">JPG, PNG or WebP · max 2 MB</p>
            </div>
          </div>
        </Field>

        <Field label="Payment Instructions (one step per line)">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet/60"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum (₹)"><Input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Maximum (₹)"><Input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))} /></Field>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 h-12 cursor-pointer">
          <span className="text-sm text-white">Deposits enabled</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-blue-600" />
        </label>

        <Button fullWidth size="lg" loading={save.isPending} onClick={onSave}>Save Settings</Button>
      </Card>
    </div>
  );
}

export default function AdminPaymentSettingsPage() {
  const { data, isLoading, isError, refetch } = useAdminPaymentSettings();
  if (isLoading) return <Skeleton className="h-96 rounded-3xl" />;
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;
  // key remounts the form (re-seeding its fields) whenever fresh server data arrives after a save
  return <PaymentSettingsForm key={JSON.stringify(data)} data={data} />;
}
