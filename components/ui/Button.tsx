'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const variantStyles = {
  primary: 'bg-[var(--accent)] text-white hover:bg-blue-600 shadow-sm',
  secondary: 'bg-white text-[var(--text)] border border-[var(--tile-border)] hover:bg-gray-50',
  danger: 'bg-red-500 text-white hover:bg-red-600 shadow-sm',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-gray-100'
};

const sizeStyles = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-4 text-base'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, disabled, ...props }, ref) => {
    return (
      <button
        className={clsx(
          'rounded-xl font-semibold transition-all duration-200 interactive-press',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          disabled && 'interactive-disabled',
          className
        )}
        disabled={disabled}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
