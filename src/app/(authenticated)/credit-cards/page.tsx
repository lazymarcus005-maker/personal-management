import { auth } from "@/auth";
import { db } from "@/db";
import { creditCards, creditCardStatements } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { CreditCardForm } from "@/components/credit-cards/credit-card-form";
import { CardCarousel } from "./card-carousel";
import { findBankLogo } from "@/lib/thai-banks";
import { format } from "date-fns";
import { CreditCard as CreditCardIcon } from "lucide-react";
import Image from "next/image";

const statementStatusStyles: Record<string, string> = {
  PAID: "bg-[#D0E77F] text-[#13141A]",
  OVERDUE: "bg-[#FFD4D4] text-[#B91C1C]",
  DEFAULT: "bg-[#FFE4C7] text-[#B45309]",
};

export default async function CreditCardsPage() {
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

  const totalCreditLimit = cards.reduce(
    (sum, c) => sum + (c.creditLimit ? parseFloat(c.creditLimit) : 0),
    0
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#EEF0F5" }}>
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#13141A]">Credit Cards</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{dateStr}</p>
          </div>
          <CreditCardForm />
        </div>

        {/* Summary */}
        <div className="mb-4">
          <p className="text-[32px] font-bold tracking-tight text-[#13141A]">
            {cards.length}{" "}
            <span className="text-lg font-normal text-[#6B7280]">
              {cards.length === 1 ? "card" : "cards"}
            </span>
          </p>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {totalCreditLimit > 0
              ? `${totalCreditLimit.toLocaleString()} THB total credit limit`
              : "active credit cards"}
          </p>
        </div>

        {/* Cards Carousel */}
        {cards.length === 0 ? (
          <div className="rounded-[20px] bg-white p-8 text-center mb-8">
            <p className="text-[#6B7280]">No credit cards added yet</p>
            <p className="text-sm text-[#6B7280] mt-1">
              Add your first card to get started.
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <CardCarousel cards={cards} />
          </div>
        )}

        {/* Recent Statements */}
        <h2 className="text-lg font-bold text-[#13141A] mb-3">
          Recent Statements
        </h2>
        {statements.length === 0 ? (
          <div className="rounded-[20px] bg-white p-8 text-center">
            <p className="text-[#6B7280]">No statements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {statements.map(({ statement, card }) => {
              const bank = findBankLogo(card.bankName);
              return (
              <div
                key={statement.id}
                className="rounded-[20px] bg-white p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0 overflow-hidden">
                  {bank ? (
                    <Image
                      src={bank.logo}
                      alt={bank.nameEN}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <CreditCardIcon className="w-5 h-5 text-[#13141A]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#13141A] truncate">
                    {card.name} · {format(statement.statementDate, "MMM yyyy")}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Due {format(statement.dueDate, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[#13141A]">
                    {parseFloat(statement.totalAmount).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-[#6B7280]">
                      THB
                    </span>
                  </p>
                  <span
                    className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      statementStatusStyles[statement.status] ??
                      statementStatusStyles.DEFAULT
                    }`}
                  >
                    {statement.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
