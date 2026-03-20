import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DevLoginIpManager } from "@/components/admin/DevLoginIpManager";

export const metadata = { title: "Dev Login IPs" };

export default async function DevLoginPage() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dev Login — Allowed IPs</h1>
        <p className="text-sm text-muted-foreground">
          Only these IP addresses can see and use the quick-login buttons on the login page.
        </p>
      </div>
      <DevLoginIpManager />
    </div>
  );
}
