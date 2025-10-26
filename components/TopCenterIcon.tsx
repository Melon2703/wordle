'use client';

import { Lightbulb } from 'lucide-react';
import clsx from 'clsx';

interface TopCenterIconProps {
  onClick: () => void;
  badgeCount?: number;
}

export function TopCenterIcon({ onClick, badgeCount }: TopCenterIconProps) {
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2">
      <button
        type="button"
        onClick={onClick}
        className={clsx(
          'relative flex h-12 w-12 items-center justify-center rounded-lg transition-colors pointer-events-auto',
          'hover:bg-blue-50'
        )}
        aria-label="Подсказки"
      >
        <Lightbulb className="h-5 w-5" />
        {badgeCount}
      </button>
    </div>
  );
}

