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
    <div className="flex min-h-dvh">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden pb-24 md:pb-0">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
