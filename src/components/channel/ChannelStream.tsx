"use client";

import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ChatImageGrid } from "@/components/shared/ChatImageGrid";
import { TradeCardDetailSheet } from "@/components/chat/TradeCardDetailSheet";
import { ReactionBar } from "./ReactionBar";
import { ChannelInput } from "./ChannelInput";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { Megaphone, Eye, Lock, Crown, ChevronDown, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";

interface TradeCardInfo {
  id: string;
  instrument: string;
  direction: string;
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  tags: string[];
  trade?: {
    id: string;
    status: string;
    finalRR: number | null;
    netProfit: number | null;
    closePrice: number | null;
  } | null;
}

export interface ChannelPostData {
  id: string;
  title: string | null;
  content: string;
  images: string[];
  isPremium: boolean;
  locked?: boolean;
  viewCount: number;
  reactions: Record<string, string[]> | null;
  createdAt: string;
  author: { id: string; name: string | null; avatar: string | null };
  tradeCard?: TradeCardInfo | null;
}

export interface LivePnlData {
  currentRR: number;
  currentPrice: number;
  targetRR: number | null;
}

interface ChannelStreamProps {
  clanId: string;
  initialPosts: ChannelPostData[];
  initialPagination: {
    page: number;
    total: number;
    totalPages: number;
  };
  initialLivePnl: Record<string, LivePnlData>;
  currentUserId: string;
  memberRole: string | null;
  isMember: boolean;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const CLOSED_STATUSES = ["TP_HIT", "SL_HIT", "BE", "CLOSED"];

function computeStaticRR(tradeCard: TradeCardInfo): string | null {
  const { entry, stopLoss, targets, direction } = tradeCard;
  const target = targets[0];
  if (!target || !stopLoss || !entry) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return null;
  const reward =
    direction === "LONG" ? target - entry : entry - target;
  const rr = reward / risk;
  if (rr <= 0) return null;
  return `1:${rr.toFixed(1)}`;
}

/* ── R:R Display Cell ── */
function RRDisplay({
  tradeCard,
  livePnl,
}: {
  tradeCard: TradeCardInfo;
  livePnl?: LivePnlData | null;
}) {
  const { t } = useTranslation();
  const trade = tradeCard.trade;
  const isClosed = trade && CLOSED_STATUSES.includes(trade.status);
  const isOpen = trade?.status === "OPEN";

  // Closed trades: show Final R:R
  if (isClosed && trade.finalRR != null) {
    const rr = trade.finalRR;
    return (
      <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
        <span className="text-muted-foreground">{t("trade.result")}</span>
        <p
          className={`font-mono font-bold ${
            rr > 0 ? "text-green-500" : rr < 0 ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          {rr > 0 ? "+" : ""}{rr.toFixed(2)}R
        </p>
        {trade.netProfit != null && (
          <p className={`font-mono text-[10px] ${
            trade.netProfit > 0 ? "text-green-500/70" : trade.netProfit < 0 ? "text-red-500/70" : "text-muted-foreground/60"
          }`}>
            {trade.netProfit > 0 ? "+" : ""}{trade.netProfit.toFixed(2)}
          </p>
        )}
      </div>
    );
  }

  // Open trades: show Live R:R from socket/server data
  if (isOpen && livePnl) {
    return (
      <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
        <span className="text-muted-foreground">{t("trade.liveRR")}</span>
        <p
          className={`font-mono font-bold ${
            livePnl.currentRR > 0
              ? "text-green-500"
              : livePnl.currentRR < 0
                ? "text-red-500"
                : "text-muted-foreground"
          }`}
        >
          {livePnl.currentRR > 0 ? "+" : ""}{livePnl.currentRR.toFixed(2)}R
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/60">
          {livePnl.currentPrice}
        </p>
        {livePnl.targetRR != null && (
          <p className="font-mono text-[10px] text-muted-foreground/60">
            {t("trade.target")}: {livePnl.targetRR.toFixed(1)}R
          </p>
        )}
      </div>
    );
  }

  // Open without live data: show spinner
  if (isOpen) {
    return (
      <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
        <span className="text-muted-foreground">{t("trade.liveRR")}</span>
        <p className="font-mono font-medium text-muted-foreground/40">
          <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
        </p>
      </div>
    );
  }

  // Pending / no trade: show static R:R ratio
  const staticRR = computeStaticRR(tradeCard);
  if (staticRR) {
    return (
      <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
        <span className="text-muted-foreground">{t("trade.riskReward")}</span>
        <p className="font-mono font-medium text-muted-foreground">
          {staticRR}
        </p>
      </div>
    );
  }

  return null;
}

/* ── Post Actions Menu (three-dot dropdown) ── */
function PostActionsMenu({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  if (!canEdit && !canDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="me-2 h-3.5 w-3.5" />
            {t("common.edit")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="me-2 h-3.5 w-3.5" />
            {t("common.delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── Edit Post Dialog ── */
function EditPostDialog({
  open,
  onOpenChange,
  post,
  clanId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: ChannelPostData | null;
  clanId: string;
  onSaved: (postId: string, data: { title?: string | null; content?: string }) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (post && open) {
      setTitle(post.title || "");
      setContent(post.content || "");
    }
  }, [post, open]);

  async function handleSave() {
    if (!post || !content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
        }),
      });
      if (res.ok) {
        onSaved(post.id, {
          title: title.trim() || null,
          content: content.trim(),
        });
        toast.success(t("chat.postUpdated"));
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update post");
      }
    } catch {
      toast.error("Failed to update post");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.editPost")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Only show title field for non-trade-card posts */}
          {post && !post.tradeCard && (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("common.optional")}
              maxLength={200}
            />
          )}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={5000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Delete Post Dialog ── */
function DeletePostDialog({
  open,
  onOpenChange,
  post,
  clanId,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: ChannelPostData | null;
  clanId: string;
  onDeleted: (postId: string) => void;
}) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!post) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/posts/${post.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDeleted(post.id);
        toast.success(t("chat.postDeleted"));
        onOpenChange(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete post");
      }
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("chat.deletePost")}</DialogTitle>
          <DialogDescription>{t("chat.deletePostConfirm")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />}
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Signal Card (trade post) ── */
function SignalCard({
  post,
  clanId,
  currentUserId,
  livePnl,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onOpenDetail,
}: {
  post: ChannelPostData;
  clanId: string;
  currentUserId: string;
  livePnl?: LivePnlData | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onOpenDetail?: () => void;
}) {
  const { t } = useTranslation();
  const reactions = (post.reactions || {}) as Record<string, string[]>;
  const tradeCard = post.tradeCard!;
  const trade = tradeCard.trade;

  // Always show 4th column for trades with any R:R data
  const isClosed = trade && CLOSED_STATUSES.includes(trade.status);
  const isOpen = trade?.status === "OPEN";
  const hasFourthCol =
    (isClosed && trade.finalRR != null) ||
    isOpen ||
    computeStaticRR(tradeCard) != null;

  return (
    <div
      className="relative cursor-pointer overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/30"
      onClick={onOpenDetail}
    >
      {/* Colored accent bar */}
      <div
        className={`absolute inset-y-0 start-0 w-1 ${
          tradeCard.direction === "LONG" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <div
        className={`absolute inset-0 ${
          tradeCard.direction === "LONG"
            ? "bg-gradient-to-b from-green-500/5 to-transparent"
            : "bg-gradient-to-b from-red-500/5 to-transparent"
        } pointer-events-none`}
      />

      <div className="relative p-3 ps-4">
        {/* Header: Direction + Instrument + Timeframe + Status + Actions */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <DirectionBadge direction={tradeCard.direction as "LONG" | "SHORT"} />
          <span className="text-base font-bold tracking-tight">
            {tradeCard.instrument}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {tradeCard.timeframe === "AUTO" ? "Auto" : tradeCard.timeframe}
          </Badge>
          {trade && <StatusBadge status={trade.status} />}
          {post.isPremium && (
            <Badge variant="default" className="gap-1 text-[10px]">
              <Crown className="h-2.5 w-2.5" />
              Pro
            </Badge>
          )}
          <div className="ms-auto">
            <PostActionsMenu
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </div>

        {/* Price Grid — 3 or 4 columns */}
        <div
          className={`mb-2 grid gap-2 text-xs ${
            hasFourthCol ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
            <span className="text-muted-foreground">{t("trade.entry")}</span>
            <p className="font-mono font-medium">{tradeCard.entry}</p>
          </div>
          <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
            <span className="text-muted-foreground">{t("trade.stopLoss")}</span>
            <p className="font-mono font-medium text-red-500">
              {tradeCard.stopLoss}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1 text-center">
            <span className="text-muted-foreground">{t("trade.target")}</span>
            <p className="font-mono font-medium text-green-500">
              {tradeCard.targets[0]}
            </p>
          </div>
          {hasFourthCol && (
            <RRDisplay tradeCard={tradeCard} livePnl={livePnl} />
          )}
        </div>

        {/* Tags */}
        {tradeCard.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {tradeCard.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Text content if any (skip raw JSON from auto-posts) */}
        {(() => {
          const raw = post.content.trim();
          if (!raw) return null;
          let displayText: string | null = raw;
          if (raw.startsWith("{")) {
            try {
              const parsed = JSON.parse(raw);
              displayText = parsed.note || null;
            } catch {
              // Not valid JSON, render as-is
            }
          }
          if (!displayText) return null;
          return (
            <p className="mb-2 text-sm text-muted-foreground italic">
              {displayText}
            </p>
          );
        })()}

        {/* Footer: author + views + reactions */}
        <div className="flex items-center gap-3 border-t pt-3">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage
              src={post.author.avatar || undefined}
              alt={post.author.name || ""}
            />
            <AvatarFallback className="text-[9px]">
              {(post.author.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium">
            {post.author.name || t("common.unknown")}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(post.createdAt)} {formatTime(post.createdAt)}
          </span>
          <div className="ms-auto flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" />
              {post.viewCount}
            </div>
            <ReactionBar
              postId={post.id}
              clanId={clanId}
              reactions={reactions}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Announcement Card (text post) ── */
function AnnouncementCard({
  post,
  clanId,
  currentUserId,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  post: ChannelPostData;
  clanId: string;
  currentUserId: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const reactions = (post.reactions || {}) as Record<string, string[]>;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      {/* Title + Actions */}
      <div className="mb-2 flex items-start justify-between">
        {post.title ? (
          <h4 className="text-base font-semibold">{post.title}</h4>
        ) : (
          <div />
        )}
        <PostActionsMenu
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Content + Images */}
      {post.images.length > 0 && !post.locked ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="relative min-w-0 flex-1">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {post.content}
            </p>
            {post.locked && (
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pt-8">
                <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                  <Lock className="h-4 w-4" />
                  {t("chat.premiumContent")}
                </div>
              </div>
            )}
            {post.isPremium && (
              <div className="mt-2">
                <Badge variant="default" className="gap-1 text-[10px]">
                  <Crown className="h-2.5 w-2.5" />
                  Pro
                </Badge>
              </div>
            )}
          </div>
          <div className="w-full shrink-0 lg:w-2/5 lg:max-w-[320px]">
            <ChatImageGrid images={post.images} />
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {post.content}
            </p>
            {post.locked && (
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pt-8">
                <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
                  <Lock className="h-4 w-4" />
                  {t("chat.premiumContent")}
                </div>
              </div>
            )}
          </div>
          {post.isPremium && (
            <div className="mt-2">
              <Badge variant="default" className="gap-1 text-[10px]">
                <Crown className="h-2.5 w-2.5" />
                Pro
              </Badge>
            </div>
          )}
        </>
      )}

      {/* Footer: author + views + reactions */}
      <div className="mt-3 flex items-center gap-3 border-t pt-3">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage
            src={post.author.avatar || undefined}
            alt={post.author.name || ""}
          />
          <AvatarFallback className="text-[9px]">
            {(post.author.name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-medium">
          {post.author.name || t("common.unknown")}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(post.createdAt)} {formatTime(post.createdAt)}
        </span>
        <div className="ms-auto flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            {post.viewCount}
          </div>
          <ReactionBar
            postId={post.id}
            clanId={clanId}
            reactions={reactions}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Main Stream ── */
export function ChannelStream({
  clanId,
  initialPosts,
  initialPagination,
  initialLivePnl,
  currentUserId,
  memberRole,
  isMember,
}: ChannelStreamProps) {
  // Display newest first (feed order)
  const [posts, setPosts] = useState<ChannelPostData[]>(initialPosts);
  const [nextPage, setNextPage] = useState(
    initialPagination.totalPages > 1 ? 2 : null
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [livePnl, setLivePnl] = useState<Record<string, LivePnlData>>(initialLivePnl);

  const canPost = memberRole === "LEADER" || memberRole === "CO_LEADER";

  const { t } = useTranslation();

  // Filter bar state
  type FilterType = "all" | "signals" | "announcements";
  const [filter, setFilter] = useState<FilterType>("all");

  // Trade detail sheet state
  const [detailTradeId, setDetailTradeId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Subscribe to real-time PnL updates via socket
  useEffect(() => {
    if (!isMember) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    // Join clan room to receive PnL broadcasts
    socket.emit(SOCKET_EVENTS.JOIN_CLAN, { clanId });

    const handlePnlUpdate = (data: {
      updates: Array<{
        tradeId: string;
        currentRR: number;
        currentPrice: number;
        targetRR?: number | null;
        riskStatus?: string;
      }>;
    }) => {
      setLivePnl((prev) => {
        const next = { ...prev };
        for (const u of data.updates) {
          next[u.tradeId] = {
            currentRR: u.currentRR,
            currentPrice: u.currentPrice,
            targetRR: u.targetRR ?? null,
          };
        }
        return next;
      });
    };

    socket.on(SOCKET_EVENTS.TRADE_PNL_UPDATE, handlePnlUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.TRADE_PNL_UPDATE, handlePnlUpdate);
    };
  }, [clanId, isMember]);

  const getLivePnl = useCallback(
    (tradeId: string | undefined) => {
      if (!tradeId) return undefined;
      return livePnl[tradeId] ?? undefined;
    },
    [livePnl]
  );

  async function loadMore() {
    if (!nextPage || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/clans/${clanId}/posts?page=${nextPage}`
      );

      if (res.ok) {
        const data = await res.json();
        const olderPosts: ChannelPostData[] = data.posts;
        setPosts((prev) => [...prev, ...olderPosts]);
        // Merge any livePnl from the new page
        if (data.livePnlMap) {
          setLivePnl((prev) => ({ ...prev, ...data.livePnlMap }));
        }
        setNextPage(
          nextPage < data.pagination.totalPages ? nextPage + 1 : null
        );
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  }

  const [editingPost, setEditingPost] = useState<ChannelPostData | null>(null);
  const [deletingPost, setDeletingPost] = useState<ChannelPostData | null>(null);

  const isLeader = memberRole === "LEADER" || memberRole === "CO_LEADER";

  function handlePostCreated(newPost: ChannelPostData) {
    setPosts((prev) => [newPost, ...prev]);
  }

  function handlePostEdited(postId: string, data: { title?: string | null; content?: string }) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, ...data } : p
      )
    );
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  function canEditPost(post: ChannelPostData) {
    return post.author.id === currentUserId;
  }

  function canDeletePost(post: ChannelPostData) {
    return post.author.id === currentUserId || isLeader;
  }

  const filteredPosts = posts.filter((post) => {
    if (filter === "all") return true;
    if (filter === "signals") return !!post.tradeCard;
    return !post.tradeCard;
  });

  if (posts.length === 0 && !canPost) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Megaphone className="h-12 w-12 text-muted-foreground" />
        <div>
          <h3 className="font-semibold">{t("chat.noPostsYet")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("chat.noPostsDesc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[960px] space-y-4">
      {/* Input area — only for leaders/co-leaders */}
      {canPost && (
        <ChannelInput clanId={clanId} onPostCreated={handlePostCreated} />
      )}

      {/* Filter bar */}
      {posts.length > 0 && (
        <div className="flex items-center gap-1">
          {(["all", "signals", "announcements"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "secondary" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setFilter(f)}
            >
              {t(`channel.filter${f[0].toUpperCase() + f.slice(1)}`)}
            </Button>
          ))}
        </div>
      )}

      {/* Empty state for canPost users */}
      {posts.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="font-semibold">{t("chat.noPostsYet")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("chat.startPosting")}
            </p>
          </div>
        </div>
      )}

      {/* Posts */}
      {filteredPosts.map((post) =>
        post.tradeCard ? (
          <SignalCard
            key={post.id}
            post={post}
            clanId={clanId}
            currentUserId={currentUserId}
            livePnl={getLivePnl(post.tradeCard.trade?.id)}
            canEdit={canEditPost(post)}
            canDelete={canDeletePost(post)}
            onEdit={() => setEditingPost(post)}
            onDelete={() => setDeletingPost(post)}
            onOpenDetail={() => {
              if (post.tradeCard?.trade?.id) {
                setDetailTradeId(post.tradeCard.trade.id);
                setDetailOpen(true);
              }
            }}
          />
        ) : (
          <AnnouncementCard
            key={post.id}
            post={post}
            clanId={clanId}
            currentUserId={currentUserId}
            canEdit={canEditPost(post)}
            canDelete={canDeletePost(post)}
            onEdit={() => setEditingPost(post)}
            onDelete={() => setDeletingPost(post)}
          />
        )
      )}

      {/* Empty filter result */}
      {posts.length > 0 && filteredPosts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("channel.noFilterResults")}
        </p>
      )}

      {/* Load more */}
      {nextPage && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
            className="gap-1.5"
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {loadingMore ? t("common.loading") : t("chat.loadMore")}
          </Button>
        </div>
      )}

      {/* Edit / Delete dialogs */}
      <EditPostDialog
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        post={editingPost}
        clanId={clanId}
        onSaved={handlePostEdited}
      />
      <DeletePostDialog
        open={deletingPost !== null}
        onOpenChange={(open) => { if (!open) setDeletingPost(null); }}
        post={deletingPost}
        clanId={clanId}
        onDeleted={handlePostDeleted}
      />
      <TradeCardDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        tradeId={detailTradeId}
        clanId={clanId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
