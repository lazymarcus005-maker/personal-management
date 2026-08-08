"use client";

import { useState, type ComponentType } from "react";
import { Receipt } from "lucide-react";

/**
 * Renders a bill/subscription logo inside a circular avatar.
 *
 * This is a Client Component so the onError fallback (hiding a broken
 * image) works even when used inside an async Server Component such as the
 * dashboard or finance page — event handlers cannot be passed to Client
 * Component props from a Server Component, so this isolates the handler.
 */
export function BillLogo({
  logoUrl,
  size = "md",
  fallbackIcon: FallbackIcon = Receipt,
}: {
  logoUrl?: string | null;
  size?: "sm" | "md";
  fallbackIcon?: ComponentType<{ className?: string }>;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const dims =
    size === "sm"
      ? "w-10 h-10"
      : "w-12 h-12";
  const iconClass = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div
      className={`${dims} rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0 overflow-hidden`}
    >
      {logoUrl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <FallbackIcon className={`${iconClass} text-[#13141A]`} />
      )}
    </div>
  );
}
