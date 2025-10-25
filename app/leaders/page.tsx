'use client';

import { useQuery } from '@tanstack/react-query';
import { getDailyPuzzle, getDailyLeaderboard, openUserProfile, getUserStatus } from '@/lib/api';
import { LoadingFallback } from '@/components/LoadingFallback';
import { UserStatsCard } from '@/components/UserStatsCard';

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
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="flex flex-1 flex-col gap-4 px-4 py-6">
            <h1 className="text-xl font-semibold font-sans">Рейтинги</h1>
        
        {/* User Stats Card */}
        {userStatus && (
          <UserStatsCard
            rank={userRankNumber}
            totalPlayers={leaderboard?.entries.length || 0}
            streak={userStatus.streak}
            arcadeSolved={userStatus.arcadeSolved}
          />
        )}
        
        <h2 className="text-sm font-semibold opacity-70">Топ игроков сегодня</h2>
        <ul className="space-y-2">
          {leaderboard?.entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold opacity-70">#{entry.rank}</span>
                {entry.profileUrl ? (
                  <button 
                    onClick={() => {
                      const telegramId = extractTelegramId(entry.profileUrl!);
                      if (telegramId) {
                        openUserProfile(telegramId, entry.displayName);
                      }
                    }}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
                  >
                    {entry.displayName}
                  </button>
                ) : (
                  <span className="font-medium">{entry.displayName}</span>
                )}
              </div>
              <div className="text-right text-xs opacity-70">
                <div>{entry.attempts} попытки</div>
                <div>{Math.round(entry.timeMs / 1000)} с</div>
              </div>
            </li>
          ))}
        </ul>
        {!leaderboard?.entries.length && (
          <div className="text-center text-sm opacity-70 py-8">
            Пока никто не решил сегодняшнее слово
          </div>
        )}
      </section>
    </main>
  );
}
