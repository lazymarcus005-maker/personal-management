import { Radio, Calendar, Check, Wallet } from "lucide-react";

const icons = {
  radio: Radio,
  calendar: Calendar,
  check: Check,
  wallet: Wallet,
};

export function SubscriptionMetricCard({
  title,
  value,
  icon,
  bgColor,
  isCurrency,
}: {
  title: string;
  value: string | number;
  icon: keyof typeof icons;
  bgColor: string;
  isCurrency?: boolean;
}) {
  const Icon = icons[icon];

  return (
    <div
      className="rounded-[20px] p-4 text-[#13141A]"
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium opacity-70">{title}</p>
        <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">
        {value}
        {isCurrency && (
          <span className="text-sm font-normal opacity-60 ml-1">THB</span>
        )}
      </p>
    </div>
  );
}
