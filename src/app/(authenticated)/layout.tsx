import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 pb-16 md:pb-0">
        <div className="container mx-auto p-6">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
