"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListTodo,
  Repeat,
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  Settings,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const primaryItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/todos", label: "Tasks", icon: ListTodo },
  { href: "/subscriptions", label: "Money", icon: Repeat },
  { href: "/credit-cards", label: "Cards", icon: CreditCard },
];

const moreItems = [
  { href: "/finance", label: "Bills", description: "Recurring bills and expenses", icon: Receipt },
  { href: "/notes", label: "Notes", description: "Ideas and useful details", icon: FileText },
  { href: "/calendar", label: "Calendar", description: "Tasks and payment dates", icon: Calendar },
  { href: "/settings", label: "Settings", description: "Profile and preferences", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreIsActive = moreItems.some((item) => pathname === item.href);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#DDE2DC] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_28px_rgba(24,32,28,0.06)] backdrop-blur-xl md:hidden"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5 items-center px-2 py-2">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "mx-auto flex min-h-12 w-full max-w-[72px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-all active:scale-95",
                isActive
                  ? "bg-[#E4EED7] text-[#18201C]"
                  : "text-[#7A847E] hover:bg-[#F4F5F0]"
              )}
            >
              <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}

        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Open more navigation"
              aria-expanded={moreOpen}
              className={cn(
                "mx-auto flex min-h-12 w-full max-w-[72px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-all active:scale-95",
                moreIsActive || moreOpen
                  ? "bg-[#E4EED7] text-[#18201C]"
                  : "text-[#7A847E] hover:bg-[#F4F5F0]"
              )}
            >
              <MoreHorizontal className="h-[19px] w-[19px]" />
              More
            </button>
          </DialogTrigger>
          <DialogContent className="gap-3">
            <div className="pr-10">
              <DialogTitle className="text-left text-xl">More</DialogTitle>
              <p className="mt-1 text-left text-sm text-[#69736D]">Everything else in your hub.</p>
            </div>
            <div className="grid gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 items-center gap-3 rounded-2xl border p-3 transition-colors active:bg-[#E9ECE7]",
                      isActive
                        ? "border-[#C8DAB4] bg-[#E4EED7]"
                        : "border-[#E2E6E0] bg-white hover:bg-[#F7F8F5]"
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F2ED]">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block truncate text-xs text-[#69736D]">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}
