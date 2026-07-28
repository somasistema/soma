import { cva } from "class-variance-authority";

// Separado de button.tsx de propósito: essa é uma função pura (só monta
// classes CSS), sem nada de client — mas button.tsx tem "use client"
// (por causa do motion.button), e qualquer export de um módulo "use
// client" vira uma referência de cliente, inclusive funções puras. Isso
// quebra Server Components que chamam buttonVariants() diretamente
// (ex: className={buttonVariants({...})} num <Link>). Mantendo em
// arquivo à parte, sem "use client", os dois lados conseguem importar.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-radius text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand",
  {
    variants: {
      variant: {
        default: "bg-brand text-brand-foreground hover:bg-brand/90",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        outline: "border border-border bg-transparent hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-status-reprovado text-white hover:bg-status-reprovado/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
