'use client';

import { useQuery } from '@tanstack/react-query';
import { getDailyPuzzle, getDailyLeaderboard, openUserProfile, getUserStatus } from '@/lib/api';
import { LoadingFallback } from '@/components/LoadingFallback';
import { UserStatsCard } from '@/components/UserStatsCard';
import { Card, Heading, Text } from '@/components/ui';
import { Target, Clock } from 'lucide-react';

export default function LeadersPage() {
  // Helper function to extract telegram_id from profileUrl
  const extractTelegramId = (profileUrl: string): string | null => {
    const match = profileUrl.match(/https:\/\/t\.me\/user\?id=(\d+)/);
    return match ? match[1] : null;
  };

  // First get the daily puzzle to get the puzzle ID
  const { data: dailyPuzzle, isLoading: puzzleLoading } = useQuery({ 
    queryKey: ['puzzle', 'daily'], 
    queryFn: getDailyPuzzle,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Then get the leaderboard using the real puzzle ID
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({ 
    queryKey: ['leaderboard', 'daily', dailyPuzzle?.puzzleId], 
    queryFn: () => getDailyLeaderboard(dailyPuzzle!.puzzleId),
    enabled: !!dailyPuzzle?.puzzleId // Only run when we have a puzzle ID
  });

  // Get user status for personal stats
  const { data: userStatus } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: getUserStatus,
    staleTime: 30 * 1000,
  });

  // Find user's rank in leaderboard
  const userRank = leaderboard?.entries.findIndex(
    entry => entry.userId === userStatus?.profileId
  );
  const userRankNumber = userRank !== undefined && userRank >= 0 ? userRank + 1 : undefined;

  // Show loading state while fetching data
  if (puzzleLoading || leaderboardLoading) {
    return <LoadingFallback length={5} />;
  }

  return (
    <main className="page-container">
      <section className="section-container">
        <Heading level={2}>Рейтинги</Heading>
        
        {/* User Stats Card */}
        {userStatus && (
          <UserStatsCard
            rank={userRankNumber}
            streak={userStatus.streak}
            arcadeSolved={userStatus.arcadeSolved}
          />
        )}
        
        <Heading level={4} className="opacity-70">Топ игроков сегодня</Heading>
        <div className="card-gap">
          {leaderboard?.entries.map((entry) => (
            <Card key={entry.userId} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Text variant="caption" className="font-semibold">#{entry.rank}</Text>
                  {entry.profileUrl ? (
                    <button 
                      onClick={() => {
                        const telegramId = extractTelegramId(entry.profileUrl!);
                        if (telegramId) {
                          openUserProfile(telegramId, entry.displayName);
                        }
                      }}
                      className="font-medium text-[var(--accent)] hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                    >
                      {entry.displayName}
                    </button>
                  ) : (
                    <Text className="font-medium">{entry.displayName}</Text>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Target className="w-4 h-4 opacity-70" />
                    <Text variant="caption">{entry.attempts}</Text>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 opacity-70" />
                    <Text variant="caption">{Math.round(entry.timeMs / 1000)} с</Text>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
        {!leaderboard?.entries.length && (
          <Card variant="dashed" padding="lg" className="text-center">
            <Text variant="caption">Пока никто не решил сегодняшнее слово</Text>
          </Card>
        )}
      </section>
    </main>
  );
}