import { auth } from "@/auth";
import { db } from "@/db";
import { financialItems } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { FinancialItemForm } from "@/components/finance/financial-item-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, Radio } from "lucide-react";

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const [bills, subscriptions] = await Promise.all([
    db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.userId, userId),
          eq(financialItems.type, "RECURRING_BILL"),
          eq(financialItems.status, "ACTIVE")
        )
      )
      .orderBy(desc(financialItems.createdAt)),
    db
      .select()
      .from(financialItems)
      .where(
        and(
          eq(financialItems.userId, userId),
          eq(financialItems.type, "SUBSCRIPTION"),
          eq(financialItems.status, "ACTIVE")
        )
      )
      .orderBy(desc(financialItems.createdAt)),
  ]);

  const monthlyTotal = [...bills, ...subscriptions].reduce(
    (sum, item) => sum + parseFloat(item.amount),
    0
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EEF0F5" }}>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#13141A]">Finance</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <FinancialItemForm />
        </div>

        {/* Summary Card */}
        <div
          className="rounded-[28px] p-6 mb-6 text-[#13141A] relative overflow-hidden"
          style={{ backgroundColor: "#D0E77F" }}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-70 mb-1">Monthly Total</p>
            <p className="text-xs opacity-60 mb-1">
              {now.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-[32px] font-bold tracking-tight mt-2">
              {monthlyTotal.toLocaleString()}{" "}
              <span className="text-lg font-normal opacity-70">THB</span>
            </p>
            <p className="text-sm mt-1 opacity-70">
              {bills.length + subscriptions.length} active items
            </p>
          </div>
          {/* Decorative circles */}
          <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 w-36 h-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 w-24 h-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-[20px] p-4 text-[#13141A] bg-[#FBD4E6]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium opacity-70">Bills</p>
              <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{bills.length}</p>
            <p className="text-xs opacity-60 mt-0.5">active bills</p>
          </div>
          <div className="rounded-[20px] p-4 text-[#13141A] bg-[#E5DBFE]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium opacity-70">Subscriptions</p>
              <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
                <Radio className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">
              {subscriptions.length}
            </p>
            <p className="text-xs opacity-60 mt-0.5">active subscriptions</p>
          </div>
        </div>

        {/* Item Lists */}
        <Tabs defaultValue="bills" dir="ltr">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-white rounded-full p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger
              value="bills"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Bills ({bills.length})
            </TabsTrigger>
            <TabsTrigger
              value="subscriptions"
              className="shrink-0 rounded-full px-4 py-1.5 text-[#6B7280] data-[state=active]:bg-[#13141A] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              Subscriptions ({subscriptions.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bills" className="mt-4">
            {bills.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">No recurring bills yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <FinancialItemCard key={bill.id} item={bill} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="subscriptions" className="mt-4">
            {subscriptions.length === 0 ? (
              <div className="rounded-[20px] bg-white p-8 text-center">
                <p className="text-[#6B7280]">No subscriptions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <FinancialItemCard key={sub.id} item={sub} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function FinancialItemCard({
  item,
}: {
  item: typeof financialItems.$inferSelect;
}) {
  const Icon = item.type === "SUBSCRIPTION" ? Radio : Receipt;
  return (
    <div className="rounded-[20px] bg-white p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#13141A]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#13141A] truncate">{item.name}</p>
          {item.autoRenew && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#D0E77F] text-[#13141A] shrink-0">
              Auto-renew
            </span>
          )}
        </div>
        <p className="text-xs text-[#6B7280] mt-0.5 truncate">
          {item.billingCycle} ·{" "}
          {item.description || item.type.replace("_", " ")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-[#13141A]">
          {parseFloat(item.amount).toLocaleString()}{" "}
          <span className="text-xs font-normal text-[#6B7280]">
            {item.currency}
          </span>
        </p>
        {item.billingDay && (
          <p className="text-xs text-[#6B7280] mt-0.5">
            Day {item.billingDay}
          </p>
        )}
      </div>
    </div>
  );
}
