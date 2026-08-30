import { auth } from "@/auth";
import { getInboxCount } from "@/lib/actions/capture";
import {
  TasksDueTodayWidget,
  OverdueTasksWidget,
  UpcomingBillsWidget,
  ActiveProjectsWidget,
  GoalProgressWidget,
  JournalPromptWidget,
  RecentNotesWidget,
  RecentExpensesWidget,
  CaptureInboxWidget,
  HealthSummaryWidget,
  UpcomingCalendarWidget,
} from "@/components/dashboard/widgets";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import Link from "next/link";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TodayDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const name = session.user.name || "User";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const inboxCount = await getInboxCount();

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Today
            </p>
            <h1 className="text-2xl font-bold text-[#13141A]">
              Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"},{" "}
              {name.split(" ")[0]}
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/capture"
              className="flex items-center gap-1.5 rounded-full bg-[#18201C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2A332D] transition-colors"
            >
              <Zap className="h-4 w-4" />
              Capture
              {inboxCount > 0 && (
                <span className="rounded-full bg-[#D0E77F] px-1.5 text-[10px] font-bold text-[#13141A]">
                  {inboxCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Configurable widget grid */}
        <DashboardGrid
          widgets={[
            {
              id: "tasks-due-today",
              node: <TasksDueTodayWidget userId={userId} />,
            },
            {
              id: "overdue-tasks",
              node: <OverdueTasksWidget userId={userId} />,
            },
            {
              id: "capture-inbox",
              node: <CaptureInboxWidget userId={userId} />,
            },
            {
              id: "upcoming-bills",
              node: <UpcomingBillsWidget userId={userId} />,
            },
            {
              id: "active-projects",
              node: <ActiveProjectsWidget userId={userId} />,
            },
            {
              id: "goal-progress",
              node: <GoalProgressWidget userId={userId} />,
            },
            {
              id: "daily-reflection",
              node: <JournalPromptWidget userId={userId} />,
            },
            {
              id: "upcoming-reminders",
              node: <UpcomingCalendarWidget userId={userId} />,
            },
            {
              id: "recent-notes",
              node: <RecentNotesWidget userId={userId} />,
            },
            {
              id: "recent-expenses",
              node: <RecentExpensesWidget userId={userId} />,
            },
            {
              id: "health-summary",
              node: <HealthSummaryWidget userId={userId} />,
            },
          ]}
          defaultVisibleCount={6}
        />
      </div>
    </div>
  );
}
