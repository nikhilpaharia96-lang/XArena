"use client";

import { MessageCircle, MessagesSquare, Send } from "lucide-react";
import { SOCIAL_LINKS } from "@/lib/social-links";

const LINKS = [
  { href: SOCIAL_LINKS.discord, label: "Discord", icon: MessagesSquare, color: "#5865F2" },
  { href: SOCIAL_LINKS.whatsapp, label: "WhatsApp", icon: MessageCircle, color: "#25D366" },
  { href: SOCIAL_LINKS.telegram, label: "Telegram", icon: Send, color: "#0088cc" },
];

export function CommunityBanner() {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-white/8">
      <div className="absolute inset-0 bg-cover bg-top" style={{ backgroundImage: "url(/images/hero-squad.webp)" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-violet-dim/40" />

      <div className="relative p-5 sm:p-6 max-w-sm">
        <h2 className="font-display font-extrabold text-xl text-white leading-tight">
          Join Our <span className="gradient-text">Community</span>
        </h2>
        <p className="text-sm text-white/70 mt-2">
          Get latest updates, tournament alerts and exclusive rewards.
        </p>
        <div className="flex items-center gap-2.5 mt-4">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={l.label}
              className="h-11 w-11 rounded-2xl flex items-center justify-center border"
              style={{ backgroundColor: `${l.color}26`, borderColor: `${l.color}4d`, color: l.color }}
            >
              <l.icon className="h-5 w-5" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
