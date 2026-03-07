"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TraderBadge } from "@/components/shared/TraderBadge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";
import Link from "next/link";

interface JoinRequest {
  id: string;
  message: string | null;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
    tradingStyle: string | null;
    role: string;
  };
}

interface JoinRequestManagerProps {
  clanId: string;
}

export function JoinRequestManager({ clanId }: JoinRequestManagerProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    fetchRequests();
  }, [clanId]);

  async function fetchRequests() {
    try {
      const res = await fetch(`/api/clans/${clanId}/join-requests`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(requestId: string, action: "APPROVED" | "REJECTED") {
    setReviewingId(requestId);
    try {
      const res = await fetch(
        `/api/clans/${clanId}/join-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );

      if (res.ok) {
        toast.success(action === "APPROVED" ? t("clan.requestApproved") : t("clan.requestRejected"));
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedReviewRequest"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">{t("clan.loadingRequests")}</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">{t("clan.noPendingRequests")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Link href={`/profile/${request.user.id}`} className="flex-shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={request.user.avatar || undefined}
                alt={request.user.name || ""}
              />
              <AvatarFallback>
                {getInitials(request.user.name || "?")}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${request.user.id}`}
                className="truncate font-medium hover:underline"
              >
                {request.user.name || "Unknown"}
              </Link>
              <TraderBadge role={request.user.role} />
            </div>
            {request.user.tradingStyle && (
              <p className="text-xs text-muted-foreground">
                {request.user.tradingStyle}
              </p>
            )}
            {request.message && (
              <p className="mt-1 text-xs text-muted-foreground italic">
                &ldquo;{request.message}&rdquo;
              </p>
            )}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReview(request.id, "APPROVED")}
              disabled={reviewingId === request.id}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleReview(request.id, "REJECTED")}
              disabled={reviewingId === request.id}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
