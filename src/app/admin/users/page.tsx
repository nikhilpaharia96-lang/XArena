"use client";

import { useState } from "react";
import { useAdminUsers, useUserAction } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Search, Ban, PauseCircle, PlayCircle, KeyRound, Wallet } from "lucide-react";

const statusTone: Record<string, "signal" | "gold" | "crimson" | "neutral"> = {
  ACTIVE: "signal",
  SUSPENDED: "gold",
  BANNED: "crimson",
  PENDING_VERIFICATION: "neutral",
};

function UserRow({ user }: { user: { id: string; username: string; email: string; status: string; role: string; depositBalance: number; winningBalance: number; bonusBalance: number } }) {
  const ban = useUserAction(user.id, "ban");
  const suspend = useUserAction(user.id, "suspend");
  const reactivate = useUserAction(user.id, "reactivate");
  const resetPassword = useUserAction(user.id, "reset-password");
  const walletAdjust = useUserAction(user.id, "wallet-adjust");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [balanceType, setBalanceType] = useState("deposit");
  const [reason, setReason] = useState("");

  const total = user.depositBalance + user.winningBalance + user.bonusBalance;

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-white text-sm">{user.username}</p>
            <Badge tone={statusTone[user.status] ?? "neutral"}>{user.status}</Badge>
            {user.role !== "USER" && <Badge tone="violet">{user.role}</Badge>}
          </div>
          <p className="text-xs text-white/40">{user.email}</p>
          <p className="text-xs font-mono text-white/50 mt-1">{formatPaise(total)} balance</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAdjustOpen(true)}>
            <Wallet className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              resetPassword.mutate(undefined, {
                onSuccess: (data) => {
                  const d = data as { temporaryPassword: string };
                  toast({ title: "Password reset", description: `Temp password: ${d.temporaryPassword}`, tone: "success" });
                },
              });
            }}
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
          {user.status === "ACTIVE" ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const r = prompt("Reason for suspension:");
                  if (r) suspend.mutate({ reason: r }, { onSuccess: () => toast({ title: "User suspended", tone: "success" }) });
                }}
              >
                <PauseCircle className="h-3.5 w-3.5 text-gold" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const r = prompt("Reason for ban:");
                  if (r) ban.mutate({ reason: r }, { onSuccess: () => toast({ title: "User banned", tone: "success" }) });
                }}
              >
                <Ban className="h-3.5 w-3.5 text-crimson" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => reactivate.mutate(undefined, { onSuccess: () => toast({ title: "User reactivated", tone: "success" }) })}>
              <PlayCircle className="h-3.5 w-3.5 text-signal" />
            </Button>
          )}
        </div>
      </div>

      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} title={`Adjust Wallet — ${user.username}`}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Amount (₹, use negative to deduct)</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Balance Type</label>
            <select value={balanceType} onChange={(e) => setBalanceType(e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white">
              <option value="deposit">Deposit</option>
              <option value="winning">Winning</option>
              <option value="bonus">Bonus</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Reason</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Compensation for tech issue" />
          </div>
          <Button
            fullWidth
            loading={walletAdjust.isPending}
            onClick={() => {
              if (!amount || reason.length < 5) {
                toast({ title: "Enter amount and a reason (5+ chars)", tone: "error" });
                return;
              }
              walletAdjust.mutate(
                { amountRupees: Number(amount), balanceType, reason },
                {
                  onSuccess: () => {
                    toast({ title: "Wallet adjusted", tone: "success" });
                    setAdjustOpen(false);
                    setAmount("");
                    setReason("");
                  },
                }
              );
            }}
          >
            Apply Adjustment
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminUsers(search || undefined);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Users</h1>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
        <Input placeholder="Search by email, username, or UID..." className="pl-11" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : data && data.users.length > 0 ? (
        <div className="space-y-2">
          {data.users.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40">No users found.</p>
      )}
    </div>
  );
}
