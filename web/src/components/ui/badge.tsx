import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: "violet" | "outline" | "secondary";
}

export function Badge({ children, className, variant = "violet" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        variant === "violet" &&
          "bg-violet-500/10 text-violet-400 border border-violet-500/20",
        variant === "outline" &&
          "border border-border text-muted-foreground",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
