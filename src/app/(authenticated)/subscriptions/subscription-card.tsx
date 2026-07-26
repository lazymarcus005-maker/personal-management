"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  Film,
  Wifi,
  Zap,
  Smartphone,
  Cloud,
  Music,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import type { financialItems as financialItemsTable } from "@/db/schema";

type Subscription = InferSelectModel<typeof financialItemsTable>;

const iconMap: Record<string, LucideIcon> = {
  netflix: Film,
  spotify: Music,
  youtube: Film,
  cloud: Cloud,
  internet: Wifi,
  mobile: Smartphone,
  electricity: Zap,
  chatgpt: BookOpen,
  copilot: BookOpen,
  default: Film,
};

function getIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return icon;
  }
  return iconMap.default;
}

function getCycleLabel(cycle: string): string {
  const map: Record<string, string> = {
    WEEKLY: "/wk",
    MONTHLY: "/mo",
    QUARTERLY: "/qtr",
    YEARLY: "/yr",
    CUSTOM: "",
  };
  return map[cycle] || "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const ACTION_WIDTH = 76;
const REVEAL_WIDTH = ACTION_WIDTH * 2;
const OPEN_THRESHOLD = REVEAL_WIDTH * 0.4;

export function SubscriptionCard({
  subscription,
  isOpen,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  subscription: Subscription;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [translateX, setTranslateX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ pointerX: 0, startTranslate: 0 });
  // Tracks whether the current pointer interaction moved past a small
  // threshold, so the click event that fires right after a drag-release
  // doesn't immediately re-close the card it just opened.
  const movedRef = useRef(false);

  useEffect(() => {
    // Syncs translateX to the isOpen prop (e.g. another card opening closes
    // this one) without fighting the pointer-driven translateX during a drag.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!dragging) setTranslateX(isOpen ? -REVEAL_WIDTH : 0);
  }, [isOpen, dragging]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { pointerX: e.clientX, startTranslate: translateX };
    movedRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const delta = e.clientX - dragStartRef.current.pointerX;
    if (Math.abs(delta) > 4) movedRef.current = true;
    setTranslateX(
      clamp(dragStartRef.current.startTranslate + delta, -REVEAL_WIDTH, 0)
    );
  }

  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    onOpenChange(translateX <= -OPEN_THRESHOLD);
  }

  function handleCardClick() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (isOpen) onOpenChange(false);
  }

  const Icon = getIcon(subscription.name);

  return (
    <div className="relative rounded-[20px] overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={onEdit}
          style={{ width: ACTION_WIDTH }}
          className="h-full flex flex-col items-center justify-center gap-1 bg-[#E5DBFE] text-[#13141A] text-xs font-medium"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ width: ACTION_WIDTH }}
          className="h-full flex flex-col items-center justify-center gap-1 bg-red-500 text-white text-xs font-medium"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={handleCardClick}
        style={{
          transform: `translateX(${translateX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
          touchAction: "pan-y",
        }}
        className="relative z-10 rounded-[20px] bg-white p-4 flex items-center gap-4 select-none"
      >
        <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0 overflow-hidden">
          {subscription.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={subscription.logoUrl}
              alt=""
              draggable={false}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            // Icon is a referentially-stable component reference picked from
            // the static iconMap above, not created fresh on each render.
            // eslint-disable-next-line react-hooks/static-components
            <Icon className="w-5 h-5 text-[#13141A]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#13141A] truncate">
            {subscription.name}
          </p>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {subscription.description || subscription.billingCycle}
            {subscription.autoRenew && " · Auto-renew"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-[#13141A]">
            {parseFloat(subscription.amount).toLocaleString()}
            <span className="text-xs font-normal text-[#6B7280] ml-0.5">
              {getCycleLabel(subscription.billingCycle)}
            </span>
          </p>
          {subscription.billingDay && (
            <p className="text-xs text-[#6B7280] mt-0.5">
              Day {subscription.billingDay}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
