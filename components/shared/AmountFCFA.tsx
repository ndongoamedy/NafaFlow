import { formatFCFA } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface AmountFCFAProps {
  amount: number | string;
  className?: string;
  highlight?: boolean;
}

export default function AmountFCFA({ amount, className, highlight = false }: AmountFCFAProps) {
  const formatted = formatFCFA(amount);

  return (
    <span
      className={cn(
        "font-semibold tracking-tight tabular-nums",
        highlight ? "text-slate-900 dark:text-white font-bold" : "text-slate-700 dark:text-slate-300",
        className
      )}
    >
      {formatted}
    </span>
  );
}
