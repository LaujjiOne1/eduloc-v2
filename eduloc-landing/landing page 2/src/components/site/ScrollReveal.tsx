import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export const ScrollReveal = ({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) => {
  const reduced = useReducedMotion();
  return <motion.div className={className} data-scroll-reveal
    initial={reduced ? false : { opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: reduced ? 0 : 0.65, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </motion.div>;
};