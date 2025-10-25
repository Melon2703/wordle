'use client';

import { Flame } from 'lucide-react';
import { Card, Heading, Text } from '@/components/ui';

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
    <Card padding="md">
      <Heading level={4} className="mb-4">Ваша статистика</Heading>
      <div className="space-y-3">
        {/* Rank */}
        <div className="flex items-center justify-between">
          <Text variant="caption">Место:</Text>
          <Text className="font-medium">
            {rank ? `#${rank} / ${totalPlayers}` : 'Не в рейтинге'}
          </Text>
        </div>

        {/* Streak */}
        <div className="flex items-center justify-between">
          <Text variant="caption" className="flex items-center gap-1">
            Серия:
            <Flame className="w-4 h-4 text-orange-500" />
          </Text>
          <Text className="font-medium">{streak}</Text>
        </div>

        {/* Arcade puzzles solved */}
        <div className="flex items-center justify-between">
          <Text variant="caption">Аркада решено:</Text>
          <Text className="font-medium">{arcadeSolved}</Text>
        </div>
      </div>
    </Card>
  );
}
