import { auth } from "@/auth";
import { db } from "@/db";
import { creditCards, creditCardStatements } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { CreditCardForm } from "@/components/credit-cards/credit-card-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";

export default async function CreditCardsPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const cards = await db
    .select()
    .from(creditCards)
    .where(
      and(eq(creditCards.userId, userId), eq(creditCards.status, "ACTIVE"))
    )
    .orderBy(desc(creditCards.createdAt));

  const statements = await db
    .select({
      statement: creditCardStatements,
      card: creditCards,
    })
    .from(creditCardStatements)
    .innerJoin(
      creditCards,
      eq(creditCardStatements.creditCardId, creditCards.id)
    )
    .where(eq(creditCards.userId, userId))
    .orderBy(desc(creditCardStatements.statementDate))
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Credit Cards
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Manage your credit cards and statements
          </p>
        </div>
        <CreditCardForm />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-neutral-500">
              No credit cards added yet
            </CardContent>
          </Card>
        ) : (
          cards.map((card) => (
            <Card key={card.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{card.name}</CardTitle>
                  <Badge variant="success">Active</Badge>
                </div>
                <p className="text-sm text-neutral-500">
                  {card.bankName} •••• {card.lastFourDigits}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Statement</span>
                  <span>Day {card.statementDay}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Payment Due</span>
                  <span>Day {card.paymentDueDay}</span>
                </div>
                {card.creditLimit && (
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-500">Limit</span>
                    <span>
                      {parseFloat(card.creditLimit).toLocaleString()} THB
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Statements</h2>
        <div className="space-y-3">
          {statements.length === 0 ? (
            <p className="text-center py-8 text-neutral-500">
              No statements yet
            </p>
          ) : (
            statements.map(({ statement, card }) => (
              <Card key={statement.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {card.name} -{" "}
                      {format(statement.statementDate, "MMM yyyy")}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Due: {format(statement.dueDate, "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {parseFloat(statement.totalAmount).toLocaleString()} THB
                    </p>
                    <Badge
                      variant={
                        statement.status === "PAID"
                          ? "success"
                          : statement.status === "OVERDUE"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {statement.status.replace("_", " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
