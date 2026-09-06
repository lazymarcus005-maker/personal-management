import { cn } from "@/lib/utils";

export function Progress({
  value = 0,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-[#EEF0F5]",
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-[#18201C] transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
