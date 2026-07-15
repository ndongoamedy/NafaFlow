import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface DateDisplayProps {
  date: Date | string | null | undefined;
  className?: string;
}

export default function DateDisplay({ date, className }: DateDisplayProps) {
  const formatted = formatDate(date);

  return (
    <span className={cn("text-slate-500 dark:text-slate-400 font-medium tabular-nums text-sm", className)}>
      {formatted}
    </span>
  );
}
