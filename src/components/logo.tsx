import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: {
    badge: "h-8 w-8 rounded-lg text-sm",
    name: "text-sm",
    tagline: "text-[9px]",
  },
  lg: {
    badge: "h-14 w-14 rounded-2xl text-2xl",
    name: "text-2xl",
    tagline: "text-xs",
  },
} as const;

export function Logo({
  size = "sm",
  stacked = false,
  tagline = size === "lg",
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  stacked?: boolean;
  tagline?: boolean;
  className?: string;
}) {
  const classes = SIZE_CLASS[size];

  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col text-center", className)}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center bg-brand font-serif-doc font-bold text-accent",
          classes.badge
        )}
      >
        S
      </span>
      <div className={cn("flex flex-col", stacked && "items-center")}>
        <span className={cn("font-serif-doc font-semibold leading-none", classes.name)}>
          <span className="text-brand">SOMA</span>
          <span className="text-accent">3+</span>
        </span>
        {tagline && (
          <span
            className={cn(
              "mt-1.5 font-medium uppercase tracking-wider text-accent",
              classes.tagline
            )}
          >
            Assessoria Imobiliária
          </span>
        )}
      </div>
    </div>
  );
}
