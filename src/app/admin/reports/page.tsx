"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileDown, TrendingUp, Trophy, Users, Gift, CreditCard } from "lucide-react";

const REPORTS = [
  { type: "revenue", label: "Revenue Report", icon: TrendingUp, desc: "Daily transaction volume by type and status" },
  { type: "tournaments", label: "Tournament Report", icon: Trophy, desc: "All tournaments with entry fees, prizes, and fill rates" },
  { type: "users", label: "User Report", icon: Users, desc: "All users with wallet balances and stats" },
  { type: "referrals", label: "Referral Report", icon: Gift, desc: "Referral chains and bonuses paid" },
  { type: "payments", label: "Payment Report", icon: CreditCard, desc: "All Razorpay deposit records" },
];

export default function AdminReportsPage() {
  const download = (type: string) => {
    window.open(`/api/admin/reports?type=${type}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">CSV Reports</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.type} className="p-5 flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-violet/15 flex items-center justify-center shrink-0">
              <r.icon className="h-5 w-5 text-violet" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{r.label}</p>
              <p className="text-xs text-white/40 mt-0.5 mb-3">{r.desc}</p>
              <Button size="sm" variant="secondary" onClick={() => download(r.type)}>
                <FileDown className="h-3.5 w-3.5" /> Download CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
