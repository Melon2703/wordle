'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'dashed';
  padding?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const variantStyles = {
  default: 'bg-white border border-[var(--tile-border)]',
  outlined: 'bg-white border-2 border-[var(--tile-border)]',
  dashed: 'bg-white border border-dashed border-[var(--tile-border)]'
};

const paddingStyles = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-8'
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', interactive = false, ...props }, ref) => {
    return (
      <div
        className={clsx(
          'rounded-2xl shadow-sm',
          variantStyles[variant],
          paddingStyles[padding],
          interactive && 'interactive-hover',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
