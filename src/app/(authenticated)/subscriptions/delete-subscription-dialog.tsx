"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFinancialItem } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";

type Subscription = InferSelectModel<typeof financialItemsTable>;

export function DeleteSubscriptionDialog({
  subscription,
  onOpenChange,
}: {
  subscription: Subscription | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!subscription) return;
    startTransition(async () => {
      await deleteFinancialItem(subscription.id);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={subscription !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-[20px]">
        <DialogHeader>
          <DialogTitle className="text-[#13141A]">
            Delete subscription?
          </DialogTitle>
          <DialogDescription>
            {subscription
              ? `"${subscription.name}" will be permanently removed. This can't be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-[14px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
            className="rounded-[14px]"
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
