'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'lg';
}

const variantStyles: Record<NonNullable<IconButtonProps['variant']>, string> = {
  primary: 'bg-[var(--accent)] text-white hover:bg-blue-600 shadow-sm',
  secondary: 'bg-white text-[var(--text)] border border-[var(--tile-border)] hover:bg-gray-50',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-gray-100'
};

const sizeStyles: Record<NonNullable<IconButtonProps['size']>, string> = {
  md: 'h-12 w-12',
  lg: 'h-14 w-14'
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'secondary', size = 'md', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'rounded-xl flex items-center justify-center transition-all duration-200 interactive-press',
          variantStyles[variant],
          sizeStyles[size],
          disabled && 'interactive-disabled',
          className
        )}
        disabled={disabled}
        {...props}
      />
    );
  }
);

IconButton.displayName = 'IconButton';
