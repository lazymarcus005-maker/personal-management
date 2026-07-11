import { auth } from "@/auth";
import { getUpcomingSubscriptionPayments } from "@/lib/actions/subscriptions";
import { format, isAfter, isBefore } from "date-fns";
import { Badge } from "@/components/ui/badge";
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

export async function UpcomingPayments() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const upcoming = await getUpcomingSubscriptionPayments();
  const now = new Date();

  if (upcoming.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold text-[#13141A] mb-3">
          Upcoming Payments
        </h2>
        <div className="rounded-[20px] bg-white p-6 text-center">
          <p className="text-sm text-[#6B7280]">
            No upcoming payments in the next 30 days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-[#13141A] mb-3">
        Upcoming Payments
      </h2>
      <div className="space-y-3">
        {upcoming.map(({ occurrence, subscription }) => {
          const Icon = getIcon(subscription.name);
          const isDue =
            isBefore(occurrence.dueDate, now) ||
            isAfter(occurrence.dueDate, now);
          const isToday =
            occurrence.dueDate.toDateString() === now.toDateString();

          return (
            <div
              key={occurrence.id}
              className="rounded-[20px] bg-white p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#13141A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#13141A] truncate">
                  {subscription.name}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Due {format(occurrence.dueDate, "MMM d, yyyy")}
                  {isToday && " · Today"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-[#13141A]">
                  {parseFloat(occurrence.expectedAmount).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-[#6B7280]">
                    THB
                  </span>
                </p>
                <Badge
                  variant={
                    occurrence.status === "DUE"
                      ? "warning"
                      : occurrence.status === "OVERDUE"
                        ? "destructive"
                        : "info"
                  }
                  className="mt-1 text-[10px] px-2 py-0.5 rounded-full"
                >
                  {occurrence.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
