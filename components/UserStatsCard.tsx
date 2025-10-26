'use client';

import { Card, Text } from '@/components/ui';

interface UserStatsCardProps {
  rank?: number;          // User's rank in leaderboard (undefined if not ranked)
  streak: number;         // Current streak
  arcadeSolved: number;   // Total arcade puzzles solved
}

export function UserStatsCard({
  rank,
  streak,
  arcadeSolved
}: UserStatsCardProps) {
  return (
    <Card padding="md">
      <div className="grid grid-cols-3 gap-4">
        {/* Место */}
        <div className="text-center">
          <Text variant="caption" className="block mb-1">Место</Text>
          <Text className="font-semibold text-lg">
            {rank ? `#${rank}` : '-'}
          </Text>
        </div>
        
        {/* Серия */}
        <div className="text-center">
          <Text variant="caption" className="block mb-1">Серия</Text>
          <Text className="font-semibold text-lg">{streak}</Text>
        </div>
        
        {/* Аркад решено */}
        <div className="text-center">
          <Text variant="caption" className="block mb-1">Аркад решено</Text>
          <Text className="font-semibold text-lg">{arcadeSolved}</Text>
        </div>
      </div>
    </Card>
  );
}
