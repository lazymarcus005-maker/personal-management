import { auth } from "@/auth";
import { getSubscriptionStats } from "@/lib/actions/subscriptions";
import { SubscriptionsHeader } from "./subscriptions-header";
import { SubscriptionMetricCard } from "./metric-card";
import { SubscriptionList } from "./subscription-list";
import { UpcomingPayments } from "./upcoming-payments";

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const stats = await getSubscriptionStats();

  const name = session.user.name || "User";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <SubscriptionsHeader name={name} date={dateStr} />

        {/* Financial Summary Card */}
        <div
          className="rounded-[28px] p-6 mb-6 text-[#13141A] relative overflow-hidden"
          style={{ backgroundColor: "#D0E77F" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-70 mb-1">
              Monthly Subscriptions
            </p>
            <p className="text-xs opacity-60 mb-1">
              {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
            <p className="text-[32px] font-bold tracking-tight mt-2">
              {stats.totalMonthly.toLocaleString()}{" "}
              <span className="text-lg font-normal opacity-70">THB</span>
            </p>
            <p className="text-sm mt-1 opacity-70">
              {stats.subscriptions.length} active subscriptions
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 w-36 h-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 w-24 h-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        {/* Metric Cards Grid */}
        <div className="mobile-carousel grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
          <SubscriptionMetricCard
            title="Active"
            value={stats.subscriptions.length}
            icon="radio"
            bgColor="#FBD4E6"
          />
          <SubscriptionMetricCard
            title="Upcoming"
            value={stats.upcomingPayments}
            icon="calendar"
            bgColor="#E5DBFE"
          />
          <SubscriptionMetricCard
            title="Paid This Month"
            value={stats.paidThisMonth}
            icon="check"
            bgColor="#ACCDFF"
          />
          <SubscriptionMetricCard
            title="Monthly Total"
            value={`${stats.totalMonthly.toLocaleString()}`}
            icon="wallet"
            bgColor="#D0E77F"
            isCurrency
          />
        </div>

        {/* Upcoming Payments */}
        <UpcomingPayments />

        {/* All Subscriptions */}
        <h2 className="text-lg font-bold text-[#13141A] mb-3 mt-8">
          All Subscriptions
        </h2>
        <SubscriptionList subscriptions={stats.subscriptions} />
      </div>
    </div>
  );
}
