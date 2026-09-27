"use client";

import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useSupportTickets, useCreateTicket } from "@/hooks/use-support";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog } from "@/components/ui/dialog";
import { toast } from "@/lib/toast-store";
import { formatDateTime } from "@/lib/format";
import { LifeBuoy, MessageSquarePlus, ChevronDown } from "lucide-react";

const FAQS = [
  { q: "How do I join a paid tournament?", a: "Add money to your wallet, open the tournament, and tap Join. The entry fee is deducted instantly." },
  { q: "When do I get my room ID and password?", a: "Room details are released shortly before the match starts and only appear for players who've joined." },
  { q: "How long does withdrawal take?", a: "Withdrawal requests are reviewed by our team and typically processed within 24-48 hours." },
  { q: "Can I withdraw my deposited money?", a: "No — only prize winnings can be withdrawn. Deposited money can only be used to join tournaments." },
  { q: "What happens if a tournament is cancelled?", a: "Your entry fee is automatically refunded to your wallet." },
];

const statusTone: Record<string, "gold" | "cobalt" | "signal" | "neutral"> = {
  OPEN: "gold",
  IN_PROGRESS: "cobalt",
  RESOLVED: "signal",
  CLOSED: "neutral",
};

export default function SupportPage() {
  useRequireAuth();
  const { data: tickets, isLoading } = useSupportTickets();
  const createTicket = useCreateTicket();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (subject.length < 3 || message.length < 10) {
      toast({ title: "Please fill in both fields", description: "Message must be at least 10 characters.", tone: "error" });
      return;
    }
    createTicket.mutate(
      { subject, message },
      {
        onSuccess: () => {
          toast({ title: "Ticket submitted", description: "Our team will respond soon.", tone: "success" });
          setDialogOpen(false);
          setSubject("");
          setMessage("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Help & Support</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <MessageSquarePlus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      <div>
        <h2 className="font-bold text-white text-sm mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <Card key={i} className="p-4">
              <button className="flex items-center justify-between w-full text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span className="text-sm font-semibold text-white">{faq.q}</span>
                <ChevronDown className={`h-4 w-4 text-white/40 transition-transform shrink-0 ml-2 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && <p className="text-sm text-white/50 mt-2 leading-relaxed">{faq.a}</p>}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-bold text-white text-sm mb-3">My Tickets</h2>
        {isLoading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white text-sm">{t.subject}</p>
                  <Badge tone={statusTone[t.status] ?? "neutral"}>{t.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-xs text-white/50 mt-1.5 line-clamp-2">{t.message}</p>
                <p className="text-[11px] text-white/30 mt-2">{formatDateTime(t.createdAt)}</p>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <LifeBuoy className="h-8 w-8 text-white/30 mx-auto mb-2" />
            <p className="text-sm text-white/50">No support tickets yet</p>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Raise a Support Ticket">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Subject</label>
            <Input placeholder="What's this about?" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue in detail..."
              rows={4}
              className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet/60"
            />
          </div>
          <Button fullWidth loading={createTicket.isPending} onClick={handleSubmit}>
            Submit Ticket
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
