import Image from "next/image";
import logoSoma from "@/assets/SOMA.png";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: { logo: "h-7", tagline: "text-[9px]" },
  lg: { logo: "h-14", tagline: "text-xs" },
} as const;

export function Logo({
  size = "sm",
  tagline = size === "lg",
  className,
}: {
  size?: keyof typeof SIZE_CLASS;
  tagline?: boolean;
  className?: string;
}) {
  const classes = SIZE_CLASS[size];

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <Image
        src={logoSoma}
        alt="SOMA Soluti"
        className={cn("w-auto object-contain", classes.logo)}
        priority={size === "lg"}
      />
      {tagline && (
        <span
          className={cn(
            "font-medium uppercase tracking-wider text-accent",
            classes.tagline
          )}
        >
          Assessoria Imobiliária
        </span>
      )}
    </div>
  );
}
