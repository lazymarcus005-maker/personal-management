import { describe, it, expect } from "vitest";
import {
  toMonthlyAmount,
  recurringMonthlyTotal,
  recurringYearlyTotal,
  monthlyIncomeExpense,
  spendingByCategory,
  spendingByArea,
  budgetVsActual,
  netWorth,
} from "@/lib/services/finance-summary";

describe("recurring normalization", () => {
  it("converts each billing cycle to a monthly amount", () => {
    expect(toMonthlyAmount({ type: "SUBSCRIPTION", amount: "300", billingCycle: "MONTHLY" })).toBe(300);
    expect(toMonthlyAmount({ type: "SUBSCRIPTION", amount: "52", billingCycle: "WEEKLY" })).toBeCloseTo(225.33, 2);
    expect(toMonthlyAmount({ type: "RECURRING_BILL", amount: "1200", billingCycle: "YEARLY" })).toBe(100);
    expect(toMonthlyAmount({ type: "RECURRING_BILL", amount: "300", billingCycle: "QUARTERLY" })).toBe(100);
    expect(toMonthlyAmount({ type: "RECURRING_BILL", amount: "99", billingCycle: "CUSTOM" })).toBe(0);
  });

  it("sums recurring items per month and year", () => {
    const items = [
      { type: "SUBSCRIPTION", amount: "100", billingCycle: "MONTHLY" },
      { type: "RECURRING_BILL", amount: "1200", billingCycle: "YEARLY" },
    ];
    expect(recurringMonthlyTotal(items)).toBe(200);
    expect(recurringYearlyTotal(items)).toBeCloseTo(2400, 6);
  });
});

describe("monthly income and expense", () => {
  it("only counts transactions inside the month and ignores transfers", () => {
    const monthStart = new Date(2026, 0, 1);
    const transactions = [
      { type: "INCOME", amount: "30000", transactionDate: new Date(2026, 0, 5) },
      { type: "EXPENSE", amount: "250.50", transactionDate: new Date(2026, 0, 10) },
      { type: "EXPENSE", amount: "100", transactionDate: new Date(2025, 11, 31) }, // prev month
      { type: "TRANSFER", amount: "5000", transactionDate: new Date(2026, 0, 15) },
    ];
    const result = monthlyIncomeExpense(transactions, monthStart);
    expect(result.income).toBe(30000);
    expect(result.expense).toBeCloseTo(250.5, 2);
  });
});

describe("grouped spending", () => {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 1, 1);
  const transactions = [
    { type: "EXPENSE", amount: "500", transactionDate: new Date(2026, 0, 3), categoryId: "cat-1", areaId: "area-1" },
    { type: "EXPENSE", amount: "300", transactionDate: new Date(2026, 0, 8), categoryId: "cat-1", areaId: "area-2" },
    { type: "EXPENSE", amount: "200", transactionDate: new Date(2026, 0, 9), categoryId: "cat-2", areaId: "area-1" },
    { type: "EXPENSE", amount: "999", transactionDate: new Date(2026, 1, 2), categoryId: "cat-1" }, // after period
    { type: "INCOME", amount: "5000", transactionDate: new Date(2026, 0, 4), categoryId: "cat-1" }, // income excluded
  ];

  it("totals spending per category within the period", () => {
    const totals = spendingByCategory(transactions, start, end);
    expect(totals.get("cat-1")).toBe(800);
    expect(totals.get("cat-2")).toBe(200);
    expect(totals.size).toBe(2);
  });

  it("totals spending per area within the period", () => {
    const totals = spendingByArea(transactions, start, end);
    expect(totals.get("area-1")).toBe(700);
    expect(totals.get("area-2")).toBe(300);
  });
});

describe("budget vs actual", () => {
  const start = new Date(2026, 0, 1);
  const end = new Date(2026, 1, 1);
  const transactions = [
    { type: "EXPENSE", amount: "400", transactionDate: new Date(2026, 0, 3), categoryId: "cat-1", areaId: "area-1" },
    { type: "EXPENSE", amount: "700", transactionDate: new Date(2026, 0, 5), categoryId: "cat-1", areaId: "area-1" },
    { type: "EXPENSE", amount: "300", transactionDate: new Date(2026, 0, 6), categoryId: "cat-2", areaId: "area-1" },
  ];

  it("compares a category budget against actual spend", () => {
    const result = budgetVsActual(
      { categoryId: "cat-1", areaId: null, amount: "1000" },
      transactions,
      start,
      end
    );
    expect(result.actual).toBe(1100);
    expect(result.remaining).toBe(-100);
    expect(result.percentUsed).toBeCloseTo(110, 6);
  });

  it("matches an area budget across categories", () => {
    const result = budgetVsActual(
      { categoryId: null, areaId: "area-1", amount: "2000" },
      transactions,
      start,
      end
    );
    expect(result.actual).toBe(1400);
  });
});

describe("net worth", () => {
  it("sums account balances", () => {
    expect(
      netWorth([
        { openingBalance: "0", currentBalance: "15000.5" },
        { openingBalance: "0", currentBalance: 2500 },
      ])
    ).toBeCloseTo(17500.5, 2);
  });

  it("returns zero with no accounts", () => {
    expect(netWorth([])).toBe(0);
  });
});
