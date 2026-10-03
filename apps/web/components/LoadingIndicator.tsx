'use client';

import { motion, useReducedMotion } from 'framer-motion';

interface LoadingIndicatorProps {
  label?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingIndicator({ label = 'Loading', size = 'medium' }: LoadingIndicatorProps) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={`loading-indicator loading-indicator--${size}`} role="status">
      <motion.span
        className="loading-indicator__ring"
        aria-hidden="true"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface LoadingStateProps {
  title: string;
  detail?: string;
  compact?: boolean;
}

export function LoadingState({ title, detail, compact = false }: LoadingStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={`loading-state ${compact ? 'loading-state--compact' : ''}`}
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <LoadingIndicator label={title} size={compact ? 'medium' : 'large'} />
      <div>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </motion.section>
  );
}
