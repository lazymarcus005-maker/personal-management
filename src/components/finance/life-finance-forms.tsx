"use client";

import { useState, useTransition } from "react";
import {
  createAccount,
  createCategory,
  createTransaction,
  createBudget,
  deleteTransaction,
} from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Wallet, Tag, PiggyBank } from "lucide-react";

type AreaOption = { id: string; name: string };
type ProjectOption = { id: string; name: string };
type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

function todayLocalISO() {
  // Format the local date directly — an ISO round-trip would shift the
  // calendar day for users east of UTC (e.g. Thailand).
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const ACCOUNT_TYPES = [
  "BANK",
  "CASH",
  "WALLET",
  "INVESTMENT",
  "CREDIT_CARD",
] as const;

export function AccountForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "BANK",
    openingBalance: "0",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createAccount({
          name: form.name,
          type: form.type as (typeof ACCOUNT_TYPES)[number],
          openingBalance: form.openingBalance || "0",
          currency: "THB",
        });
        setForm({ name: "", type: "BANK", openingBalance: "0" });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Wallet className="h-4 w-4" /> Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="account-opening">Opening balance</Label>
            <Input
              id="account-opening"
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={(e) =>
                setForm((f) => ({ ...f, openingBalance: e.target.value }))
              }
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <Tag className="h-4 w-4" /> Category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                await createCategory({ name });
                setName("");
                setOpen(false);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Failed to create category"
                );
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionForm({
  accounts,
  categories,
  areas,
  projects,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  areas: AreaOption[];
  projects: ProjectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "EXPENSE",
    amount: "",
    accountId: accounts[0]?.id ?? "",
    categoryId: "none",
    transactionDate: todayLocalISO(),
    merchant: "",
    description: "",
    areaId: "none",
    projectId: "none",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createTransaction({
          type: form.type as "INCOME" | "EXPENSE" | "TRANSFER",
          amount: form.amount,
          accountId: form.accountId,
          categoryId: form.categoryId === "none" ? null : form.categoryId,
          currency: "THB",
          // Anchor at the client's local midnight — a bare date key would be
          // parsed as UTC midnight and shift the day for UTC-west users.
          transactionDate: new Date(`${form.transactionDate}T00:00:00`).toISOString(),
          merchant: form.merchant || undefined,
          description: form.description || undefined,
          areaId: form.areaId === "none" ? null : form.areaId,
          projectId: form.projectId === "none" ? null : form.projectId,
        });
        setForm((f) => ({
          ...f,
          amount: "",
          merchant: "",
          description: "",
          transactionDate: todayLocalISO(),
        }));
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to record transaction");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" aria-label="New transaction" className="rounded-full">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Record transaction</DialogTitle>
        </DialogHeader>
        {accounts.length === 0 ? (
          <p className="text-sm text-[#69736D]">
            Create an account first — transactions need somewhere to live.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={set("type")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INCOME">Income</SelectItem>
                    <SelectItem value="EXPENSE">Expense</SelectItem>
                    {/* TRANSFER is intentionally not offered yet: the schema
                        has a single account per transaction, so a transfer
                        cannot debit one account and credit another. */}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="txn-amount">Amount</Label>
                <Input
                  id="txn-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => set("amount")(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={form.accountId} onValueChange={set("accountId")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.categoryId} onValueChange={set("categoryId")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                value={form.transactionDate}
                onChange={(e) => set("transactionDate")(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="txn-merchant">Merchant</Label>
                <Input
                  id="txn-merchant"
                  value={form.merchant}
                  onChange={(e) => set("merchant")(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="txn-desc">Description</Label>
                <Input
                  id="txn-desc"
                  value={form.description}
                  onChange={(e) => set("description")(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Area</Label>
                <Select value={form.areaId} onValueChange={set("areaId")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No area</SelectItem>
                    {areas.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.projectId} onValueChange={set("projectId")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BudgetForm({
  categories,
  areas,
}: {
  categories: CategoryOption[];
  areas: AreaOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: "none",
    areaId: "none",
    amount: "",
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createBudget({
          categoryId: form.categoryId === "none" ? null : form.categoryId,
          areaId: form.areaId === "none" ? null : form.areaId,
          period: "MONTHLY",
          amount: form.amount,
          currency: "THB",
        });
        setForm({ categoryId: "none", areaId: "none", amount: "" });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create budget");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1">
          <PiggyBank className="h-4 w-4" /> Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New monthly budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <Select
              value={form.areaId}
              onValueChange={(v) => setForm((f) => ({ ...f, areaId: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No area</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-amount">Monthly amount</Label>
            <Input
              id="budget-amount"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTransactionButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7"
      aria-label="Delete transaction"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => void (await deleteTransaction(id)))
      }
    >
      <Trash2 className="h-3.5 w-3.5 text-[#7A847E]" />
    </Button>
  );
}
