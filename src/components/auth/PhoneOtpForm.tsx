"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface PhoneOtpFormProps {
  mode: "login" | "add-phone";
  onVerified: (token: string) => void;
  onNewUser?: (signupToken: string) => void;
}

const COUNTDOWN_SECONDS = 120;

export function PhoneOtpForm({ mode, onVerified, onNewUser }: PhoneOtpFormProps) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOtp = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send OTP");
        setLoading(false);
        return;
      }

      setStep("otp");
      setCountdown(COUNTDOWN_SECONDS);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [phone]);

  async function handleVerify() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        setLoading(false);
        return;
      }

      if (data.mode === "add-phone") {
        onVerified(data.token);
      } else if (data.isNewUser) {
        onNewUser?.(data.token);
      } else {
        onVerified(data.token);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const formatCountdown = () => {
    const m = Math.floor(countdown / 60);
    const s = countdown % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (step === "phone") {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            dir="ltr"
            placeholder="09123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={11}
          />
          <p className="text-xs text-muted-foreground">
            Enter your Iranian mobile number
          </p>
        </div>
        <Button
          className="w-full"
          onClick={sendOtp}
          disabled={loading || !/^09\d{9}$/.test(phone)}
        >
          {loading ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            "Send Code"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        Code sent to <span className="font-medium text-foreground" dir="ltr">{phone}</span>
      </p>
      <div className="space-y-2">
        <Label htmlFor="otp-code">Verification Code</Label>
        <Input
          id="otp-code"
          type="text"
          inputMode="numeric"
          dir="ltr"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          maxLength={6}
        />
      </div>
      <Button
        className="w-full"
        onClick={handleVerify}
        disabled={loading || code.length !== 6}
      >
        {loading ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify"
        )}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-muted-foreground hover:underline"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
          }}
        >
          Change number
        </button>
        {countdown > 0 ? (
          <span className="text-muted-foreground">
            Resend in {formatCountdown()}
          </span>
        ) : (
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={sendOtp}
            disabled={loading}
          >
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
