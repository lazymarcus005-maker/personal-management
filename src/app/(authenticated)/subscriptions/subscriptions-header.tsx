"use client";

import { Bell, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubscriptionFormDialog } from "./subscription-form-dialog";

export function SubscriptionsHeader({
  name,
  date,
}: {
  name: string;
  date: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#13141A]">
            Welcome, {name.split(" ")[0]}!
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowForm(true)}
            className="w-10 h-10 rounded-full bg-[#13141A] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center relative shadow-sm">
            <Bell className="w-5 h-5 text-[#13141A]" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#E5DBFE] flex items-center justify-center text-sm font-semibold text-[#13141A]">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
      <SubscriptionFormDialog open={showForm} onOpenChange={setShowForm} />
    </>
  );
}
