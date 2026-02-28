import { log } from "@/lib/audit";

const KAVENEGAR_API_KEY = process.env.KAVENEGAR_API_KEY;
const KAVENEGAR_OTP_TEMPLATE = process.env.KAVENEGAR_OTP_TEMPLATE || "clantrader-otp";

export async function sendOtp(phone: string, code: string): Promise<void> {
  if (!KAVENEGAR_API_KEY) {
    console.log("\n=== DEV SMS OTP ===");
    console.log("Phone:", phone);
    console.log("Code:", code);
    console.log("===================\n");
    return;
  }

  const url = `https://api.kavenegar.com/v1/${KAVENEGAR_API_KEY}/verify/lookup.json`;
  const params = new URLSearchParams({
    receptor: phone,
    token: code,
    template: KAVENEGAR_OTP_TEMPLATE,
  });

  const res = await fetch(`${url}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    log("auth.sms_api_error", "ERROR", "AUTH", { phone, status: res.status, body });
    throw new Error("Failed to send SMS");
  }
}
