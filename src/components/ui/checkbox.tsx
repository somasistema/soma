"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import * as React from "react";

const Checkbox = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<typeof motion.input>>(
  ({ className, ...props }, ref) => {
    return (
      <motion.input
        type="checkbox"
        ref={ref}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.12 }}
        className={cn(
          "h-4 w-4 shrink-0 rounded-sm border border-border text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
