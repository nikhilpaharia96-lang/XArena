"use client";

import Link from "next/link";
import { ArrowRight, Gift, Ticket, Crown, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useReferral } from "@/hooks/use-referral";
import { formatPaise } from "@/lib/format";

/** ₹50 is the platform's real signup referral bonus (see
 * SIGNUP_REFERRAL_BONUS_PAISE in /api/auth/signup) — shown as a static
 * constant since there's no public "config" endpoint for it yet. */
const REFERRAL_BONUS_PAISE = 5000;

export function ReferEarnBanner() {
  const { data: me } = useCurrentUser();
  const { data: referral } = useReferral();

  return (
    <section className="relative rounded-3xl overflow-hidden border border-gold/20">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/images/refer-earn-banner.jpg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-void/10" />

      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-gold mb-2">
            <Gift className="h-3.5 w-3.5" /> REFER &amp; EARN
          </span>
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white leading-tight">
            Invite Friends
            <br />
            Get Rewards!
          </h2>
          <p className="text-white/75 text-sm mt-2 max-w-sm">
            Invite your friends and earn bonus wallet balance on every successful signup.
          </p>
          <Link
            href="/referral"
            className="inline-flex items-center gap-1.5 mt-4 rounded-xl bg-gold px-4 h-10 text-sm font-bold text-void"
          >
            Invite Now <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {me && referral && referral.totalInvites > 0 && (
            <p className="text-xs text-white/60 mt-3">
              You&apos;ve invited {referral.totalInvites} friend{referral.totalInvites === 1 ? "" : "s"} and earned {formatPaise(referral.totalEarned)} so far.
            </p>
          )}
        </div>

        <div className="flex sm:flex-col gap-2 shrink-0">
          <div className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl bg-black/40 border border-white/15 px-3 py-2 backdrop-blur-sm">
            <Users className="h-4 w-4 text-gold shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-none">{formatPaise(REFERRAL_BONUS_PAISE)}</p>
              <p className="text-[10px] text-white/60 mt-0.5">Per Friend</p>
            </div>
          </div>
          <div className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl bg-black/40 border border-white/15 px-3 py-2 backdrop-blur-sm">
            <Ticket className="h-4 w-4 text-cobalt shrink-0" />
            <p className="text-xs font-semibold text-white/85">Exclusive Tournaments</p>
          </div>
          <div className="flex-1 sm:flex-none flex items-center gap-2 rounded-xl bg-black/40 border border-white/15 px-3 py-2 backdrop-blur-sm">
            <Crown className="h-4 w-4 text-gold shrink-0" />
            <p className="text-xs font-semibold text-white/85">Special Rewards</p>
          </div>
        </div>
      </div>
    </section>
  );
}
