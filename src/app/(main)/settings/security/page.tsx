import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { SecuritySettings } from "@/components/settings/SecuritySettings";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      phone: true,
      phoneVerified: true,
      email: true,
      emailVerified: true,
      passwordHash: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security</h1>
        <p className="text-muted-foreground">
          Manage your phone number, email, and password
        </p>
      </div>
      <SecuritySettings
        phone={user.phone}
        phoneVerified={!!user.phoneVerified}
        email={user.email}
        emailVerified={!!user.emailVerified}
        hasPassword={!!user.passwordHash}
      />
    </div>
  );
}
