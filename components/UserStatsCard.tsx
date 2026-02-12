'use client';

import { Flame } from 'lucide-react';

interface UserStatsCardProps {
  rank?: number;          // User's rank in leaderboard (undefined if not ranked)
  totalPlayers: number;   // Total players in leaderboard
  streak: number;         // Current streak
  arcadeSolved: number;   // Total arcade puzzles solved
}

export function UserStatsCard({
  rank,
  totalPlayers,
  streak,
  arcadeSolved
}: UserStatsCardProps) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Ваша статистика</h3>
      <div className="space-y-3 text-sm">
        {/* Rank */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Место:</span>
          <span className="font-medium text-slate-800">
            {rank ? `#${rank} / ${totalPlayers}` : 'Не в рейтинге'}
          </span>
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600 flex items-center gap-1">
            Серия:
            <Flame className="w-4 h-4 text-orange-500" />
          </span>
          <span className="font-medium text-slate-800">{streak}</span>
        </div>

        {/* Arcade puzzles solved */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Аркада решено:</span>
          <span className="font-medium text-slate-800">{arcadeSolved}</span>
        </div>
      </div>
    </div>
  );
}
