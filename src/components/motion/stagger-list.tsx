"use client";

import { motion, type HTMLMotionProps } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

// Envolve uma lista (linhas de tabela, cards) pra animar a entrada dos
// StaggerItem filhos em cascata, em vez de tudo aparecer de uma vez.
export function StaggerList(props: HTMLMotionProps<"div">) {
  return <motion.div variants={containerVariants} initial="hidden" animate="show" {...props} />;
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return <motion.div variants={itemVariants} {...props} />;
}

// Mesma coisa, mas como <tbody>/<tr> — pra tabelas, onde motion.div
// quebraria a semântica de <table>.
export function StaggerTableBody(props: HTMLMotionProps<"tbody">) {
  return <motion.tbody variants={containerVariants} initial="hidden" animate="show" {...props} />;
}

export function StaggerRow(props: HTMLMotionProps<"tr">) {
  return <motion.tr variants={itemVariants} {...props} />;
}
