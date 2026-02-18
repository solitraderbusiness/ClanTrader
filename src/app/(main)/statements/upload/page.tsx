import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StatementUploadForm } from "@/components/statements/StatementUploadForm";

export default async function UploadStatementPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload Statement</h1>
        <p className="text-muted-foreground">
          Upload your MT4 or MT5 HTML trading statement for verification.
        </p>
      </div>
      <StatementUploadForm />
    </div>
  );
}
