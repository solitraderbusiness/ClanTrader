"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { TraderBadge } from "@/components/shared/TraderBadge";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

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
        toast.success(action === "APPROVED" ? "Request approved" : "Request rejected");
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to review request");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading requests...</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">No pending join requests</p>
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
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage
              src={request.user.avatar || undefined}
              alt={request.user.name || ""}
            />
            <AvatarFallback>
              {(request.user.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">
                {request.user.name || "Unknown"}
              </span>
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
