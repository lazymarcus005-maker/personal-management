"use client";

import {
  Film,
  Wifi,
  Zap,
  Smartphone,
  Cloud,
  Music,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

type Subscription = InferSelectModel<typeof financialItemsTable>;

const iconMap: Record<string, LucideIcon> = {
  netflix: Film,
  spotify: Music,
  youtube: Film,
  cloud: Cloud,
  internet: Wifi,
  mobile: Smartphone,
  electricity: Zap,
  chatgpt: BookOpen,
  copilot: BookOpen,
  default: Film,
};

function getIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return icon;
  }
  return iconMap.default;
}

function getCycleLabel(cycle: string): string {
  const map: Record<string, string> = {
    WEEKLY: "/wk",
    MONTHLY: "/mo",
    QUARTERLY: "/qtr",
    YEARLY: "/yr",
    CUSTOM: "",
  };
  return map[cycle] || "";
}

export function SubscriptionList({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-8 text-center">
        <p className="text-[#6B7280]">No active subscriptions yet.</p>
        <p className="text-sm text-[#6B7280] mt-1">
          Add your first subscription to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {subscriptions.map((sub) => {
        const Icon = getIcon(sub.name);
        return (
          <div
            key={sub.id}
            className="rounded-[20px] bg-white p-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-[#13141A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#13141A] truncate">
                {sub.name}
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {sub.description || sub.billingCycle}
                {sub.autoRenew && " · Auto-renew"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-[#13141A]">
                {parseFloat(sub.amount).toLocaleString()}
                <span className="text-xs font-normal text-[#6B7280] ml-0.5">
                  {getCycleLabel(sub.billingCycle)}
                </span>
              </p>
              {sub.billingDay && (
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Day {sub.billingDay}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
