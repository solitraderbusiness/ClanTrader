"use client";

import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  isConnected: boolean;
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {isConnected ? (
        <>
          <Wifi className="h-3 w-3 text-green-500" /> Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-500" /> Reconnecting...
        </>
      )}
    </div>
  );
}
