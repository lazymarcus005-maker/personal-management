"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFinancialItem } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Plus } from "lucide-react";

const formSchema = z.object({
  type: z.enum(["RECURRING_BILL", "SUBSCRIPTION"]),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string(),
  billingCycle: z.enum([
    "WEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
    "CUSTOM",
  ]),
  billingDay: z.number().min(1).max(31).optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  autoRenew: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

export function FinancialItemForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "SUBSCRIPTION",
      currency: "THB",
      billingCycle: "MONTHLY",
      autoRenew: false,
    },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      await createFinancialItem(data);
      reset();
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          New Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Bill / Subscription</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                defaultValue="SUBSCRIPTION"
                onValueChange={(v) =>
                  setValue(
                    "type",
                    v as "RECURRING_BILL" | "SUBSCRIPTION"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECURRING_BILL">Bill</SelectItem>
                  <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing Cycle</Label>
              <Select
                defaultValue="MONTHLY"
                onValueChange={(v) =>
                  setValue(
                    "billingCycle",
                    v as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" | "CUSTOM"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-red-500">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingDay">Billing Day</Label>
              <Input
                id="billingDay"
                type="number"
                min="1"
                max="31"
                {...register("billingDay", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-red-500">
                  {errors.startDate.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register("endDate")} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="autoRenew"
              onCheckedChange={(v) => setValue("autoRenew", v)}
            />
            <Label htmlFor="autoRenew">Auto Renew</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
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
