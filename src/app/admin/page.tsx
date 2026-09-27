"use client";

import { useAdminAnalytics } from "@/hooks/use-admin";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { formatPaise, formatDateTime } from "@/lib/format";
import { Users, Trophy, Wallet, TrendingUp, AlertCircle, LifeBuoy } from "lucide-react";

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />;

  const { kpis, recentActivity } = data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={kpis.totalUsers} icon={Users} tone="text-cobalt" />
        <StatCard label="Active Users" value={kpis.activeUsers} icon={Users} tone="text-signal" />
        <StatCard label="Tournaments" value={kpis.totalTournaments} icon={Trophy} tone="text-gold" />
        <StatCard label="Live Now" value={kpis.liveTournaments} icon={Trophy} tone="text-crimson" />
        <StatCard label="Total Deposits" value={formatPaise(kpis.totalDeposits)} icon={Wallet} tone="text-signal" />
        <StatCard label="Total Withdrawals" value={formatPaise(kpis.totalWithdrawals)} icon={Wallet} tone="text-gold" />
        <StatCard label="Platform Revenue" value={formatPaise(kpis.revenue)} icon={TrendingUp} tone="text-violet" />
        <StatCard label="Prizes Awarded" value={formatPaise(kpis.totalPrizesAwarded)} icon={Trophy} tone="text-gold" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-gold" />
          <div>
            <p className="text-lg font-black text-white">{kpis.pendingWithdrawals}</p>
            <p className="text-xs text-white/40">Pending Withdrawals</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-cobalt" />
          <div>
            <p className="text-lg font-black text-white">{kpis.pendingResults}</p>
            <p className="text-xs text-white/40">Results To Verify</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <LifeBuoy className="h-5 w-5 text-crimson" />
          <div>
            <p className="text-lg font-black text-white">{kpis.openTickets}</p>
            <p className="text-xs text-white/40">Open Tickets</p>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="font-bold text-white text-sm mb-3">Recent Activity</h2>
        <Card className="divide-y divide-white/5">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-white/40 p-4">No activity yet.</p>
          ) : (
            recentActivity.map((a) => (
              <div key={a.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-medium">{a.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-white/40">
                    {a.actorUsername ?? "System"} {a.targetType && `· ${a.targetType}`}
                  </p>
                </div>
                <span className="text-xs text-white/30">{formatDateTime(a.createdAt)}</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
