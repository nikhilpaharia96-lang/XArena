"use client";

import Link from "next/link";
import { Plus, Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-auth";

/**
 * Tournament creation is admin/moderator-only in this app today (there's
 * no public "organizer" flow in the schema or API). Rather than pointing
 * a regular player at a route that will 403 them, non-privileged users see
 * a card that connects to a real feature instead: referrals.
 */
export function CreateTournamentCard() {
  const { data: me } = useCurrentUser();
  const isAdmin = me && ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(me.user.role);

  if (isAdmin) {
    return (
      <Card className="p-5 flex items-center gap-4 border border-gold/20">
        <div className="h-12 w-12 rounded-2xl bg-gold/15 flex items-center justify-center shrink-0">
          <Plus className="h-6 w-6 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Create Your Tournament</p>
          <p className="text-xs text-white/50">Bring your community together.</p>
        </div>
        <Link href="/admin/tournaments/new">
          <Button variant="cta" size="sm">
            Create
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-5 flex items-center gap-4 glow-border">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/refer-earn-banner.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/40" />

      <div className="relative h-12 w-12 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 backdrop-blur-sm">
        <Gift className="h-6 w-6 text-gold" />
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="font-bold text-white text-sm">Refer & Earn</p>
        <p className="text-xs text-white/70">Invite friends and earn bonus cash when they join.</p>
      </div>
      <Link href="/referral" className="relative">
        <Button variant="secondary" size="sm">
          Invite
        </Button>
      </Link>
    </Card>
  );
}
