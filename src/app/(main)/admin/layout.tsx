import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata = { title: "Admin Panel" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex gap-6">
      <aside className="hidden w-48 flex-shrink-0 lg:block">
        <div className="sticky top-20">
          <h2 className="mb-4 text-lg font-bold">Admin Panel</h2>
          <AdminSidebar />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
