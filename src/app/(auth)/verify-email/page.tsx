import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/lib/db";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const { token } = await searchParams;

  let status: "success" | "error" = "error";
  let message = "No verification token provided.";

  if (token) {
    const user = await db.user.findFirst({
      where: { verifyToken: token },
    });

    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerified: new Date(),
          verifyToken: null,
        },
      });
      status = "success";
      message = "Your email has been verified! You can now sign in.";
    } else {
      message = "Invalid or expired verification token.";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Verification</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "success" && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {message}
          </div>
        )}
        {status === "error" && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {message}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href="/login">Go to Sign in</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
