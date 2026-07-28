"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

export interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

// Entrada padrão de página/seção — usar no wrapper principal de cada tela.
export function FadeIn({ delay = 0, children, ...props }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: EASE }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
