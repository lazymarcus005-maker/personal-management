"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCreditCard, updateCreditCard } from "@/lib/actions/credit-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import type { creditCards as creditCardsTable } from "@/db/schema";

type CreditCard = InferSelectModel<typeof creditCardsTable>;

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
  logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

const emptyDefaults: FormData = {
  name: "",
  bankName: "",
  lastFourDigits: "",
  creditLimit: "",
  statementDay: 1,
  paymentDueDay: 1,
  color: "#6366f1",
  notes: "",
  logoUrl: "",
};

function cardToFormData(card: CreditCard): FormData {
  return {
    name: card.name,
    bankName: card.bankName,
    lastFourDigits: card.lastFourDigits,
    creditLimit: card.creditLimit ?? "",
    statementDay: card.statementDay,
    paymentDueDay: card.paymentDueDay,
    color: card.color ?? "#6366f1",
    notes: card.notes ?? "",
    logoUrl: card.logoUrl ?? "",
  };
}

export function CreditCardFormDialog({
  open,
  onOpenChange,
  card,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: CreditCard | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = Boolean(card);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyDefaults,
  });

  useEffect(() => {
    if (open) {
      reset(card ? cardToFormData(card) : emptyDefaults);
    }
  }, [open, card?.id, reset]);

  const logoUrl = watch("logoUrl");

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      if (card) {
        await updateCreditCard(card.id, data);
      } else {
        await createCreditCard(data);
      }
      reset();
      onOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Credit Card" : "Add Credit Card"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="logoUrl">Logo URL</Label>
            <div className="flex items-center gap-3">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover shrink-0 bg-[#EEF0F5]"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.visibility = "visible";
                  }}
                />
              )}
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                {...register("logoUrl")}
              />
            </div>
            <p className="text-xs text-[#6B7280]">
              Leave blank to auto-detect the bank logo.
            </p>
            {errors.logoUrl && (
              <p className="text-xs text-red-500">{errors.logoUrl.message}</p>
            )}
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
          <div className="grid gap-4 sm:grid-cols-3">
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Adding..."
                : isEditing
                  ? "Save Changes"
                  : "Add Card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
