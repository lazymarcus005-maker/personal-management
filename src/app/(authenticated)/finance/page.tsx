import { auth } from "@/auth";
import { db } from "@/db";
import { financialItems, financialOccurrences } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { FinancialItemForm } from "@/components/finance/financial-item-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Manage bills and subscriptions
          </p>
        </div>
        <FinancialItemForm />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
            <p className="text-xs text-neutral-500">active bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-neutral-500">active subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {monthlyTotal.toLocaleString()} THB
            </div>
            <p className="text-xs text-neutral-500">combined monthly</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Bills ({bills.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">
            Subscriptions ({subscriptions.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="mt-4">
          <div className="space-y-3">
            {bills.length === 0 ? (
              <p className="text-center py-8 text-neutral-500">
                No recurring bills yet
              </p>
            ) : (
              bills.map((bill) => (
                <FinancialItemCard key={bill.id} item={bill} />
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="subscriptions" className="mt-4">
          <div className="space-y-3">
            {subscriptions.length === 0 ? (
              <p className="text-center py-8 text-neutral-500">
                No subscriptions yet
              </p>
            ) : (
              subscriptions.map((sub) => (
                <FinancialItemCard key={sub.id} item={sub} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinancialItemCard({
  item,
}: {
  item: typeof financialItems.$inferSelect;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{item.name}</p>
            {item.autoRenew && (
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                Auto-renew
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">
            {item.billingCycle} - {item.description || item.type.replace("_", " ")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">
            {parseFloat(item.amount).toLocaleString()} {item.currency}
          </p>
          {item.billingDay && (
            <p className="text-xs text-neutral-500">
              Day {item.billingDay} of month
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
