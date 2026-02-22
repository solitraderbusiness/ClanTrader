"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { MessageSquare, User } from "lucide-react";

interface UserProfileSheetProps {
  userId: string | null;
  currentUserId: string;
  onClose: () => void;
}

type ProfileUser = {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatar: string | null;
  role: string;
  tradingStyle: string | null;
  sessionPreference: string | null;
  preferredPairs: string[];
  isPro: boolean;
  createdAt: string;
  clanMemberships?: {
    role: string;
    clan: { id: string; name: string; avatar: string | null };
  }[];
  statements?: {
    extractedMetrics: Record<string, unknown> | null;
    verificationMethod: string;
  }[];
};

type FetchResult = {
  userId: string;
  user: ProfileUser | null;
};

export function UserProfileSheet({
  userId,
  currentUserId,
  onClose,
}: UserProfileSheetProps) {
  const router = useRouter();
  const [result, setResult] = useState<FetchResult | null>(null);
  const fetchIdRef = useRef(0);

  const isOpen = userId !== null && userId !== currentUserId;

  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchId = ++fetchIdRef.current;

    fetch(`/api/users/${userId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (fetchId === fetchIdRef.current) {
          setResult({ userId, user: data });
        }
      })
      .catch(() => {
        if (fetchId === fetchIdRef.current) {
          setResult({ userId, user: null });
        }
      });
  }, [userId, isOpen]);

  const isFetched = result?.userId === userId;
  const displayUser = isOpen && isFetched ? result.user : null;
  const displayLoading = isOpen && !isFetched;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
          <SheetDescription className="sr-only">
            User profile details
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-4">
          {displayLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-32 rounded bg-muted" />
                  <div className="h-4 w-48 rounded bg-muted" />
                </div>
              </div>
              <div className="h-16 rounded-lg bg-muted" />
              <div className="h-16 rounded-lg bg-muted" />
            </div>
          ) : displayUser ? (
            <ProfileCard user={displayUser} />
          ) : (
            <p className="text-center text-muted-foreground">
              User not found
            </p>
          )}
        </div>

        {displayUser && (
          <SheetFooter>
            <Button
              className="w-full"
              onClick={() => {
                onClose();
                router.push(`/dm/${displayUser.id}`);
              }}
            >
              <MessageSquare className="me-2 h-4 w-4" />
              Send Message
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose();
                router.push(`/profile/${displayUser.id}`);
              }}
            >
              <User className="me-2 h-4 w-4" />
              View Profile
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
