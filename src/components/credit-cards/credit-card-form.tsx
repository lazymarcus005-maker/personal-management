"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreditCardFormDialog } from "./credit-card-form-dialog";

export function CreditCardForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-full bg-[#13141A] text-white flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <Plus className="w-5 h-5" />
      </button>
      <CreditCardFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
