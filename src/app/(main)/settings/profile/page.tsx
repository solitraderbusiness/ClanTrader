import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export default async function SettingsProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      avatar: true,
      tradingStyle: true,
      sessionPreference: true,
      preferredPairs: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Profile</h1>
        <p className="text-muted-foreground">
          Update your trading profile and preferences
        </p>
      </div>
      <ProfileEditForm user={user} />
    </div>
  );
}
