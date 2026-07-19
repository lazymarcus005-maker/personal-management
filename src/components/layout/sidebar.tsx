"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  ListTodo,
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  Settings,
  LogOut,
  Repeat,
  WalletCards,
} from "lucide-react";
import { signOut } from "next-auth/react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/todos", label: "Todos", icon: ListTodo },
  { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/finance", label: "Bills", icon: Receipt },
  { href: "/credit-cards", label: "Credit Cards", icon: CreditCard },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-[#DDE2DC] bg-[#FAFBF8] md:flex">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#18201C] text-white">
          <WalletCards className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight">Poj</h1>
          <p className="text-xs text-[#7A847E]">Personal finance</p>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1.5 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "h-11 w-full justify-start gap-3 rounded-xl px-3 text-[#69736D]",
                  isActive && "bg-[#E4EED7] font-semibold text-[#18201C] shadow-none"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="p-3">
        <Button
          variant="ghost"
          className="h-11 w-full justify-start gap-3 rounded-xl text-[#69736D] hover:bg-red-50 hover:text-red-600"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
