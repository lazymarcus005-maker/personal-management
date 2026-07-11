"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListTodo,
  Repeat,
  Receipt,
  CreditCard,
  FileText,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/todos", label: "Todo", icon: ListTodo },
  { href: "/subscriptions", label: "Subs", icon: Repeat },
  { href: "/finance", label: "Bills", icon: Receipt },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/credit-cards", label: "Cards", icon: CreditCard },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                isActive
                  ? "text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-500 dark:text-neutral-400"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
