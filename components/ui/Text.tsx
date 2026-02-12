'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'caption';
  className?: string;
}

const variantStyles = {
  body: 'text-body',
  caption: 'text-caption'
};

export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({ variant = 'body', className, children, ...props }, ref) => {
    return (
      <p
        className={clsx(variantStyles[variant], className)}
        ref={ref}
        {...props}
      >
        {children}
      </p>
    );
  }
);

Text.displayName = 'Text';
