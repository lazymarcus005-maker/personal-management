"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCreditCard } from "@/lib/actions/credit-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Card name is required"),
  bankName: z.string().min(1, "Bank name is required"),
  lastFourDigits: z
    .string()
    .length(4, "Must be 4 digits")
    .regex(/^\d{4}$/, "Must be 4 digits"),
  creditLimit: z.string().optional(),
  statementDay: z.number().min(1).max(31),
  paymentDueDay: z.number().min(1).max(31),
  color: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function CreditCardForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      color: "#6366f1",
    },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      await createCreditCard(data);
      reset();
      setOpen(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-1" />
          Add Card
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Credit Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Card Name</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input id="bankName" {...register("bankName")} />
              {errors.bankName && (
                <p className="text-xs text-red-500">
                  {errors.bankName.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastFourDigits">Last 4 Digits</Label>
            <Input
              id="lastFourDigits"
              maxLength={4}
              {...register("lastFourDigits")}
            />
            {errors.lastFourDigits && (
              <p className="text-xs text-red-500">
                {errors.lastFourDigits.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statementDay">Statement Day</Label>
              <Input
                id="statementDay"
                type="number"
                min={1}
                max={31}
                {...register("statementDay", { valueAsNumber: true })}
              />
              {errors.statementDay && (
                <p className="text-xs text-red-500">
                  {errors.statementDay.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDueDay">Payment Due Day</Label>
              <Input
                id="paymentDueDay"
                type="number"
                min={1}
                max={31}
                {...register("paymentDueDay", { valueAsNumber: true })}
              />
              {errors.paymentDueDay && (
                <p className="text-xs text-red-500">
                  {errors.paymentDueDay.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditLimit">Credit Limit</Label>
              <Input
                id="creditLimit"
                type="number"
                step="0.01"
                {...register("creditLimit")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" {...register("notes")} />
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
              {isPending ? "Adding..." : "Add Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
