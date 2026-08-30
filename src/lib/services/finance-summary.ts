/**
 * Pure finance summary calculations. No database access so they can be unit
 * tested and reused by the dashboard, review pages, and finance page.
 */

export interface RecurringItemLike {
  type: string; // RECURRING_BILL | SUBSCRIPTION
  amount: string | number;
  billingCycle: string;
  status?: string | null;
}

export interface RecurringScheduleLike {
  billingCycle: string;
  billingDay?: number | null;
  startDate?: Date | string | null;
}

function addMonthsClamped(anchor: Date, months: number): Date {
  // Keeps the anchor's day-of-month fixed and clamps to the target month's
  // length (Jan 31 + 1 month = Feb 28, and Mar 31 the month after — no drift).
  const target = new Date(anchor.getFullYear(), anchor.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(anchor.getDate(), lastDay));
}

/**
 * Next occurrence of a recurring item on or after `today` (local calendar).
 *
 * Anchors on the item's startDate when the cycle maps to a month step
 * (MONTHLY/QUARTERLY/YEARLY); falls back to the billing day-of-month, then to
 * stepping weekly from the start date. Returns null when nothing can be
 * derived.
 */
export function nextDueDate(
  item: RecurringScheduleLike,
  today: Date = new Date()
): Date | null {
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const monthSteps = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 } as Record<string, number>;
  const start = item.startDate ? new Date(item.startDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;

  if (validStart && monthSteps[item.billingCycle]) {
    // Step from the start date in whole cycle units so the anchor day never
    // drifts through short months.
    const steps = monthSteps[item.billingCycle];
    let cursor = new Date(
      validStart.getFullYear(),
      validStart.getMonth(),
      validStart.getDate()
    );
    for (let i = 0; i < 1300 && cursor < dayStart; i++) {
      cursor = addMonthsClamped(validStart, (i + 1) * steps);
    }
    if (cursor >= dayStart) return cursor;
  }

  if (item.billingDay && item.billingDay >= 1 && item.billingDay <= 31) {
    for (let add = 0; add < 2; add++) {
      const month = new Date(today.getFullYear(), today.getMonth() + add, 1);
      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      if (item.billingDay <= lastDay) {
        const candidate = new Date(month.getFullYear(), month.getMonth(), item.billingDay);
        if (candidate >= dayStart) return candidate;
      }
    }
  }

  if (validStart && item.billingCycle === "WEEKLY") {
    let cursor = new Date(
      validStart.getFullYear(),
      validStart.getMonth(),
      validStart.getDate()
    );
    for (let i = 0; i < 520 && cursor < dayStart; i++) {
      cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    if (cursor >= dayStart) return cursor;
  }

  return null;
}

export interface TransactionLike {
  type: string; // INCOME | EXPENSE | TRANSFER
  amount: string | number;
  transactionDate: Date | string;
  categoryId?: string | null;
  areaId?: string | null;
  projectId?: string | null;
}

/** Normalizes one recurring charge to its monthly cost. */
export function toMonthlyAmount(item: RecurringItemLike): number {
  const amount = typeof item.amount === "string" ? parseFloat(item.amount) : item.amount;
  switch (item.billingCycle) {
    case "WEEKLY":
      return (amount * 52) / 12;
    case "QUARTERLY":
      return amount / 3;
    case "YEARLY":
      return amount / 12;
    case "MONTHLY":
      return amount;
    default:
      // CUSTOM and unknown cycles are not amortized.
      return 0;
  }
}

export function recurringMonthlyTotal(items: RecurringItemLike[]): number {
  return items.reduce((sum, item) => sum + toMonthlyAmount(item), 0);
}

export function recurringYearlyTotal(items: RecurringItemLike[]): number {
  return recurringMonthlyTotal(items) * 12;
}

function isInPeriod(date: Date | string, periodStart: Date, periodEnd: Date): boolean {
  const d = date instanceof Date ? date : new Date(date);
  return d >= periodStart && d < periodEnd;
}

function sumBy(transactions: TransactionLike[], type: string): number {
  return transactions
    .filter((t) => t.type === type)
    .reduce(
      (sum, t) =>
        sum + (typeof t.amount === "string" ? parseFloat(t.amount) : t.amount),
      0
    );
}

export function monthlyIncomeExpense(
  transactions: TransactionLike[],
  monthStart: Date
): { income: number; expense: number } {
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const inMonth = transactions.filter((t) =>
    isInPeriod(t.transactionDate, monthStart, monthEnd)
  );
  return {
    income: sumBy(inMonth, "INCOME"),
    expense: sumBy(inMonth, "EXPENSE"),
  };
}

export function spendingByCategory(
  transactions: TransactionLike[],
  periodStart: Date,
  periodEnd: Date
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE" || !t.categoryId) continue;
    if (!isInPeriod(t.transactionDate, periodStart, periodEnd)) continue;
    const amount =
      typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + amount);
  }
  return totals;
}

export function spendingByArea(
  transactions: TransactionLike[],
  periodStart: Date,
  periodEnd: Date
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE" || !t.areaId) continue;
    if (!isInPeriod(t.transactionDate, periodStart, periodEnd)) continue;
    const amount =
      typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
    totals.set(t.areaId, (totals.get(t.areaId) ?? 0) + amount);
  }
  return totals;
}

export function spendingByProject(
  transactions: TransactionLike[],
  periodStart: Date,
  periodEnd: Date
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "EXPENSE" || !t.projectId) continue;
    if (!isInPeriod(t.transactionDate, periodStart, periodEnd)) continue;
    const amount =
      typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
    totals.set(t.projectId, (totals.get(t.projectId) ?? 0) + amount);
  }
  return totals;
}

export interface BudgetLike {
  categoryId: string | null;
  areaId: string | null;
  amount: string | number;
}

/** Budget vs actual for a single budget row within the period. */
export function budgetVsActual(
  budget: BudgetLike,
  transactions: TransactionLike[],
  periodStart: Date,
  periodEnd: Date
): { budget: number; actual: number; remaining: number; percentUsed: number } {
  const budgetAmount =
    typeof budget.amount === "string" ? parseFloat(budget.amount) : budget.amount;

  let actual = 0;
  for (const t of transactions) {
    if (t.type !== "EXPENSE") continue;
    if (!isInPeriod(t.transactionDate, periodStart, periodEnd)) continue;
    if (budget.categoryId && t.categoryId !== budget.categoryId) continue;
    if (budget.areaId && t.areaId !== budget.areaId) continue;
    if (!budget.categoryId && !budget.areaId) continue;
    actual +=
      typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
  }

  return {
    budget: budgetAmount,
    actual,
    remaining: budgetAmount - actual,
    percentUsed: budgetAmount > 0 ? (actual / budgetAmount) * 100 : 0,
  };
}

export interface AccountLike {
  openingBalance: string | number;
  currentBalance: string | number;
}

/** Net worth = sum of current balances across all accounts. */
export function netWorth(accounts: AccountLike[]): number {
  return accounts.reduce((sum, a) => {
    const v =
      typeof a.currentBalance === "string"
        ? parseFloat(a.currentBalance)
        : a.currentBalance;
    return sum + v;
  }, 0);
}
