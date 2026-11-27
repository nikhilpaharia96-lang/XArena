"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, SendHorizontal, UserMinus } from "lucide-react";
import { useMessages, useRemoveFriendship, useSendMessage, type ChatMessage } from "@/hooks/use-friends";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { UserAvatar, displayNameOf } from "./user-avatar";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

const MAX = 1000;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toDateString();

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
          mine ? "gradient-brand text-white rounded-br-md" : "bg-surface-2 text-white border border-white/10 rounded-bl-md"
        )}
      >
        {m.body}
        <span className={cn("mt-1 flex items-center justify-end gap-1 text-[11px]", mine ? "text-white/70" : "text-white/40")}>
          {timeOf(m.createdAt)}
          {mine && (m.readAt ? <CheckCheck className="h-3 w-3" aria-label="Seen" /> : <Check className="h-3 w-3" aria-label="Sent" />)}
        </span>
      </div>
    </div>
  );
}

export function ChatView({ friendshipId, meId, onBack }: { friendshipId: string; meId: string; onBack: () => void }) {
  const { data, isLoading, isError, refetch } = useMessages(friendshipId);
  const send = useSendMessage(friendshipId);
  const remove = useRemoveFriendship();
  const [text, setText] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCount = useRef(0);

  const messages = useMemo(() => data?.messages ?? [], [data]);

  // Keep pinned to the newest message unless the reader scrolled up to read history.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grew = messages.length !== lastCount.current;
    const lastIsMine = messages[messages.length - 1]?.senderId === meId;
    if (grew && (stickToBottom.current || lastIsMine)) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  }, [messages, meId]);

  useEffect(() => {
    stickToBottom.current = true;
    lastCount.current = 0;
  }, [friendshipId]);

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    send.mutate(body, {
      onSuccess: () => { setText(""); stickToBottom.current = true; },
      onError: (e) => toast({ title: "Message not sent", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
    });
  };

  const doRemove = () =>
    remove.mutate(friendshipId, {
      onSuccess: () => { toast({ title: "Friend removed", tone: "success" }); onBack(); },
      onError: (e) => toast({ title: "Couldn't remove", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
    });

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5">
        <button onClick={onBack} aria-label="Back to chats" className="md:hidden h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        {data ? (
          <>
            <UserAvatar user={data.friend} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{displayNameOf(data.friend)}</p>
              <p className="truncate text-xs text-white/40">@{data.friend.username}</p>
            </div>
          </>
        ) : (
          <Skeleton className="h-10 flex-1 rounded-xl" />
        )}
        {confirmRemove ? (
          <div className="flex items-center gap-1.5 text-xs">
            <button onClick={doRemove} disabled={remove.isPending} className="rounded-lg bg-crimson px-2.5 py-1.5 font-semibold text-white">Remove</button>
            <button onClick={() => setConfirmRemove(false)} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white/70">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmRemove(true)} aria-label="Remove friend" title="Remove friend" className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-white/5">
            <UserMinus className="h-4 w-4 text-white/50" />
          </button>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4"
      >
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className={cn("h-10 w-2/3 rounded-2xl", i % 2 && "ml-auto")} />)}</div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-white/40">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m, i) => (
            <div key={m.id}>
              {(i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt)) && (
                <p className="my-3 text-center text-[11px] font-semibold text-white/35">{dayLabel(m.createdAt)}</p>
              )}
              <Bubble m={m} mine={m.senderId === meId} />
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="flex items-end gap-2 border-t border-white/10 p-3"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
          rows={1}
          placeholder="Type a message"
          aria-label="Message"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet/60"
        />
        <button
          type="submit"
          disabled={!text.trim() || send.isPending}
          aria-label="Send"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full gradient-brand text-white disabled:opacity-40"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
