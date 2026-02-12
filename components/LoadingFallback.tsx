'use client';

import { PuzzleLoader } from './PuzzleLoader';

interface LoadingFallbackProps {
  length?: number;
}

export function LoadingFallback({ length = 5 }: LoadingFallbackProps) {
  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
      <div className="flex flex-1 items-center justify-center">
        <PuzzleLoader length={length} />
      </div>
    </main>
  );
}
