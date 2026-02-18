"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Trash2, Plus } from "lucide-react";

interface Invite {
  id: string;
  code: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  createdAt: string;
}

interface InviteManagerProps {
  clanId: string;
}

export function InviteManager({ clanId }: InviteManagerProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("");
  const [maxUses, setMaxUses] = useState("");

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(`/api/clans/${clanId}/invites`);
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch {
      toast.error("Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [clanId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  async function handleCreate() {
    setCreating(true);
    try {
      const body: Record<string, number> = {};
      if (expiresInHours) body.expiresInHours = parseInt(expiresInHours);
      if (maxUses) body.maxUses = parseInt(maxUses);

      const res = await fetch(`/api/clans/${clanId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Invite created");
        setShowForm(false);
        setExpiresInHours("");
        setMaxUses("");
        fetchInvites();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create invite");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(inviteId: string) {
    try {
      const res = await fetch(`/api/clans/${clanId}/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Invite revoked");
        setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      } else {
        toast.error("Failed to revoke invite");
      }
    } catch {
      toast.error("Something went wrong");
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied!");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading invites...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Invite Links</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="me-1 h-4 w-4" />
          New Invite
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="expiresInHours">Expires in (hours)</Label>
            <Input
              id="expiresInHours"
              type="number"
              placeholder="No expiry"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxUses">Max uses</Label>
            <Input
              id="maxUses"
              type="number"
              placeholder="Unlimited"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating} size="sm">
            {creating ? "Creating..." : "Create"}
          </Button>
        </div>
      )}

      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active invites. Create one to share with others.
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => {
            const isExpired =
              invite.expiresAt && new Date(invite.expiresAt) < new Date();
            const isMaxed =
              invite.maxUses !== null && invite.uses >= invite.maxUses;

            return (
              <div
                key={invite.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <code className="text-sm">{invite.code}</code>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>
                      Uses: {invite.uses}
                      {invite.maxUses ? `/${invite.maxUses}` : ""}
                    </span>
                    {invite.expiresAt && (
                      <span>
                        {isExpired
                          ? "Expired"
                          : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                      </span>
                    )}
                    {isMaxed && <span className="text-destructive">Maxed</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyLink(invite.code)}
                  disabled={!!isExpired || !!isMaxed}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(invite.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
