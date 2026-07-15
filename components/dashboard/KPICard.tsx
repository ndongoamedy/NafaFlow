import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  trendLabel: string;
  icon: LucideIcon;
  iconClassName?: string;
  className?: string;
}

export default function KPICard({
  title,
  value,
  delta,
  trend,
  trendLabel,
  icon: Icon,
  iconClassName,
  className,
}: KPICardProps) {
  const isPositive = trend === "up";
  const isNegative = trend === "down";

  return (
    <Card className={cn("bg-white border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group select-none", className)}>
      <CardContent className="p-6">
        {/* Card Header (Title + Icon) */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-400 tracking-tight group-hover:text-slate-500 transition-colors uppercase">
            {title}
          </span>
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center bg-slate-50 group-hover:bg-slate-100 transition-all duration-300 border border-slate-100 shrink-0",
            iconClassName
          )}>
            <Icon className="h-5 w-5 text-slate-600 transition-transform duration-300 group-hover:scale-110" />
          </div>
        </div>

        {/* Card Body (Large Metric Value) */}
        <div className="mt-4">
          <h3 className="text-2xl font-bold tracking-tight text-slate-800 tabular-nums">
            {value}
          </h3>
        </div>

        {/* Card Footer (Delta Metric & Trend Label) */}
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          {delta && (
            <div
              className={cn(
                "flex items-center px-1.5 py-0.5 rounded-md font-semibold tracking-wide gap-0.5",
                isPositive && "bg-emerald-50 text-emerald-700",
                isNegative && "bg-rose-50 text-rose-700",
                trend === "neutral" && "bg-slate-100 text-slate-600"
              )}
            >
              {isPositive && <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />}
              {isNegative && <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />}
              <span>{delta}</span>
            </div>
          )}
          <span className="text-slate-400 font-medium">
            {trendLabel}
          </span>
        </div>

        {/* Decorative dynamic background border hover */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent group-hover:bg-[#16A34A]/20 transition-all duration-300" />
      </CardContent>
    </Card>
  );
}
