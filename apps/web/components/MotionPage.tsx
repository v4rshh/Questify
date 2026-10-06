'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ComponentPropsWithoutRef } from 'react';

type MotionPageProps = ComponentPropsWithoutRef<typeof motion.main>;

export default function MotionPage({ children, ...props }: MotionPageProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      {...props}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.main>
  );
}
