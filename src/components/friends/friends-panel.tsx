"use client";
import { useState } from "react";
import { Check, Clock, MessageCircle, Search, UserPlus, X } from "lucide-react";
import {
  useFriends, useRespondToRequest, useRemoveFriendship, useSendFriendRequest, useUserSearch,
  type FriendItem, type RequestItem, type SearchUser,
} from "@/hooks/use-friends";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { UserAvatar, displayNameOf } from "./user-avatar";
import { ChatView } from "./chat-view";
import { ApiClientError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";

type Tab = "chats" | "requests" | "find";

const errToast = (title: string) => (e: unknown) =>
  toast({ title, description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" });

function ChatRow({ f, active, meId, onOpen }: { f: FriendItem; active: boolean; meId: string; onOpen: () => void }) {
  const preview = f.lastMessage ? `${f.lastMessage.senderId === meId ? "You: " : ""}${f.lastMessage.body}` : "Say hi 👋";
  return (
    <button
      onClick={onOpen}
      className={cn("flex w-full min-h-[68px] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors max-md:border max-md:border-white/10 max-md:bg-surface", active ? "bg-violet/15" : "hover:bg-white/5 active:bg-white/10")}
    >
      <UserAvatar user={f.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-bold text-white">{displayNameOf(f.user)}</p>
          {f.lastMessage && <span className="shrink-0 text-[11px] text-white/35">{formatRelativeTime(f.lastMessage.createdAt)}</span>}
        </div>
        <p className={cn("truncate text-xs", f.unread ? "font-semibold text-white" : "text-white/45")}>{preview}</p>
      </div>
      {f.unread > 0 && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet px-1.5 text-[11px] font-bold text-white" aria-label={`${f.unread} unread`}>
          {f.unread > 99 ? "99+" : f.unread}
        </span>
      )}
    </button>
  );
}

function RequestRow({ r, kind }: { r: RequestItem; kind: "incoming" | "outgoing" }) {
  const respond = useRespondToRequest();
  const cancel = useRemoveFriendship();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
      <UserAvatar user={r.user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{displayNameOf(r.user)}</p>
        <p className="truncate text-xs text-white/40">@{r.user.username} · {formatRelativeTime(r.createdAt)}</p>
      </div>
      {kind === "incoming" ? (
        <div className="flex gap-1.5">
          <Button size="sm" loading={respond.isPending} onClick={() => respond.mutate({ id: r.friendshipId, action: "accept" }, { onSuccess: () => toast({ title: `You and ${r.user.username} are now friends`, tone: "success" }), onError: errToast("Couldn't accept") })}>
            <Check className="h-4 w-4" /> Accept
          </Button>
          <Button size="sm" variant="secondary" aria-label="Decline" disabled={respond.isPending} onClick={() => respond.mutate({ id: r.friendshipId, action: "decline" }, { onError: errToast("Couldn't decline") })}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate(r.friendshipId, { onError: errToast("Couldn't cancel") })}>
          Cancel
        </Button>
      )}
    </div>
  );
}

function FindTab({ onOpenChat }: { onOpenChat: (friendshipId: string) => void }) {
  const [q, setQ] = useState("");
  const { data, isFetching } = useUserSearch(q);
  const add = useSendFriendRequest();
  const respond = useRespondToRequest();

  const action = (u: SearchUser) => {
    if (u.relation === "FRIENDS" && u.friendshipId)
      return <Button size="sm" variant="secondary" onClick={() => onOpenChat(u.friendshipId!)}><MessageCircle className="h-4 w-4" /> Chat</Button>;
    if (u.relation === "REQUEST_SENT")
      return <Badge tone="neutral"><Clock className="h-3 w-3" /> Requested</Badge>;
    if (u.relation === "REQUEST_RECEIVED" && u.friendshipId)
      return (
        <Button size="sm" loading={respond.isPending} onClick={() => respond.mutate({ id: u.friendshipId!, action: "accept" }, { onSuccess: () => toast({ title: "Friend added", tone: "success" }), onError: errToast("Couldn't accept") })}>
          <Check className="h-4 w-4" /> Accept
        </Button>
      );
    return (
      <Button size="sm" loading={add.isPending && add.variables === u.id} onClick={() => add.mutate(u.id, { onSuccess: () => toast({ title: "Friend request sent", tone: "success" }), onError: errToast("Couldn't send request") })}>
        <UserPlus className="h-4 w-4" /> Add
      </Button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <Input aria-label="Search players" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username or UID" className="pl-10" autoComplete="off" />
      </div>
      {q.trim().length < 2 ? (
        <p className="px-1 text-xs text-white/40">Type at least 2 characters to find a player.</p>
      ) : isFetching && !data ? (
        <Skeleton className="h-16 rounded-2xl" />
      ) : data && data.users.length > 0 ? (
        <div className="space-y-2">
          {data.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
              <UserAvatar user={u} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{displayNameOf(u)}</p>
                <p className="truncate text-xs text-white/40">@{u.username}</p>
              </div>
              {action(u)}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-1 text-sm text-white/45">No players found.</p>
      )}
    </div>
  );
}

export function FriendsPanel({ meId }: { meId: string }) {
  const [tab, setTab] = useState<Tab>("chats");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useFriends();

  const pending = data?.counts.pendingRequests ?? 0;
  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "chats", label: "Chats", badge: data?.counts.unreadMessages },
    { id: "requests", label: "Requests", badge: pending },
    { id: "find", label: "Add Friend" },
  ];

  const openChat = (id: string) => { setOpenId(id); setTab("chats"); };
  // If the friend was removed (by either side) while the chat is open, fall back to the list.
  const stillFriend = openId && data?.friends.some((f) => f.friendshipId === openId);
  const activeId = stillFriend ? openId : null;

  return (
    <div className="md:grid md:h-[640px] md:grid-cols-[340px_1fr] md:overflow-hidden md:rounded-3xl md:border md:border-white/10 md:bg-surface">
      <aside className={cn("flex flex-col border-white/10 md:min-h-0 md:border-r", activeId && "max-md:hidden")}>
        <div className="flex gap-1.5 overflow-x-auto pb-3 md:p-3 no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn("flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold", tab === t.id ? "gradient-brand border-transparent text-white" : "border-white/10 bg-white/5 text-white/60")}
            >
              {t.label}
              {!!t.badge && <span className="rounded-full bg-crimson px-1.5 text-[11px] font-bold text-white">{t.badge}</span>}
            </button>
          ))}
        </div>

        <div className="space-y-1 pb-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-1 h-16 rounded-2xl" />)
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : tab === "chats" ? (
            data && data.friends.length > 0 ? (
              data.friends.map((f) => <ChatRow key={f.friendshipId} f={f} meId={meId} active={f.friendshipId === activeId} onOpen={() => setOpenId(f.friendshipId)} />)
            ) : (
              <EmptyState
                icon={MessageCircle}
                title="No friends yet"
                description="Add players to chat and team up."
                action={<Button size="sm" onClick={() => setTab("find")}>Add Friend</Button>}
              />
            )
          ) : tab === "requests" ? (
            <div className="space-y-4 px-1">
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">Received ({data?.incoming.length ?? 0})</h2>
                {data?.incoming.length ? data.incoming.map((r) => <RequestRow key={r.friendshipId} r={r} kind="incoming" />) : <p className="text-sm text-white/40">No pending requests.</p>}
              </section>
              {!!data?.outgoing.length && (
                <section className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">Sent ({data.outgoing.length})</h2>
                  {data.outgoing.map((r) => <RequestRow key={r.friendshipId} r={r} kind="outgoing" />)}
                </section>
              )}
            </div>
          ) : (
            <div className="px-1"><FindTab onOpenChat={openChat} /></div>
          )}
        </div>
      </aside>

      <section className={cn("md:min-h-0", activeId ? "max-md:fixed max-md:inset-0 max-md:z-[70] max-md:bg-void max-md:pt-[env(safe-area-inset-top)]" : "hidden md:flex md:items-center md:justify-center")}>
        {activeId ? (
          <ChatView key={activeId} friendshipId={activeId} meId={meId} onBack={() => setOpenId(null)} />
        ) : (
          <div className="text-center text-white/35">
            <MessageCircle className="mx-auto mb-2 h-10 w-10" />
            <p className="text-sm">Select a friend to start chatting</p>
          </div>
        )}
      </section>
    </div>
  );
}
