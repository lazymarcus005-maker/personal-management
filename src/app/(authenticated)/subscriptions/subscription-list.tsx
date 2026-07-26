"use client";

import { useState } from "react";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";
import { SubscriptionCard } from "./subscription-card";
import { SubscriptionFormDialog } from "./subscription-form-dialog";
import { DeleteSubscriptionDialog } from "./delete-subscription-dialog";

type Subscription = InferSelectModel<typeof financialItemsTable>;

export function SubscriptionList({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [editingSubscription, setEditingSubscription] =
    useState<Subscription | null>(null);
  const [deletingSubscription, setDeletingSubscription] =
    useState<Subscription | null>(null);

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-8 text-center">
        <p className="text-[#6B7280]">No active subscriptions yet.</p>
        <p className="text-sm text-[#6B7280] mt-1">
          Add your first subscription to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {subscriptions.map((sub) => (
          <SubscriptionCard
            key={sub.id}
            subscription={sub}
            isOpen={openCardId === sub.id}
            onOpenChange={(open) => setOpenCardId(open ? sub.id : null)}
            onEdit={() => {
              setOpenCardId(null);
              setEditingSubscription(sub);
            }}
            onDelete={() => {
              setOpenCardId(null);
              setDeletingSubscription(sub);
            }}
          />
        ))}
      </div>
      <SubscriptionFormDialog
        open={editingSubscription !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSubscription(null);
        }}
        subscription={editingSubscription}
      />
      <DeleteSubscriptionDialog
        subscription={deletingSubscription}
        onOpenChange={(open) => {
          if (!open) setDeletingSubscription(null);
        }}
      />
    </>
  );
}
