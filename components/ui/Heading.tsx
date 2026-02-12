'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4;
  className?: string;
}

const levelStyles = {
  1: 'heading-1',
  2: 'heading-2', 
  3: 'heading-3',
  4: 'heading-4'
};

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, className, children, ...props }, ref) => {
    const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
    
    return (
      <Component
        className={clsx(levelStyles[level], className)}
        ref={ref}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Heading.displayName = 'Heading';
