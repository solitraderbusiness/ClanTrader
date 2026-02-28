import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { OnboardingIntentModal } from "@/components/onboarding/OnboardingIntentModal";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <SessionProvider>
      <AppShell>{children}</AppShell>
      {session?.user && !session.user.onboardingComplete && (
        <OnboardingIntentModal />
      )}
    </SessionProvider>
  );
}
