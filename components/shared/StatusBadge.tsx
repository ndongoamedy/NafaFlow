import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type InvoiceStatus = "payée" | "partiellement payée" | "envoyée" | "brouillon" | "en retard" | string;

interface StatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.trim().toLowerCase();

  const getStatusStyles = () => {
    switch (normalized) {
      case "payée":
      case "payee":
      case "accepted":
      case "accepté":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700";
      case "partiellement payée":
      case "partiellement payee":
      case "partial":
        return "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50 hover:text-orange-700";
      case "envoyée":
      case "envoyee":
      case "sent":
        return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-700";
      case "brouillon":
      case "draft":
        return "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-600";
      case "en retard":
      case "overdue":
      case "refusé":
      case "refused":
        return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 hover:text-rose-700";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-600";
    }
  };

  const getDisplayLabel = () => {
    switch (normalized) {
      case "payée":
      case "payee":
      case "accepted":
      case "accepté":
        return "Payée";
      case "partiellement payée":
      case "partiellement payee":
      case "partial":
        return "Partiellement payée";
      case "envoyée":
      case "envoyee":
      case "sent":
        return "Envoyée";
      case "brouillon":
      case "draft":
        return "Brouillon";
      case "en retard":
      case "overdue":
        return "En retard";
      default:
        return status;
    }
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "px-2.5 py-1 text-xs font-semibold rounded-lg border tracking-wide uppercase transition-all duration-200 shrink-0",
        getStatusStyles(),
        className
      )}
    >
      {getDisplayLabel()}
    </Badge>
  );
}
