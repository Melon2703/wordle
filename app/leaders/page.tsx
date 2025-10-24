'use client';

import { useQuery } from '@tanstack/react-query';
import { getDailyPuzzle, getDailyLeaderboard } from '@/lib/api';

export default function LeadersPage() {
  // First get the daily puzzle to get the puzzle ID
  const { data: dailyPuzzle } = useQuery({ 
    queryKey: ['puzzle', 'daily'], 
    queryFn: getDailyPuzzle,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Then get the leaderboard using the real puzzle ID
  const { data: leaderboard } = useQuery({ 
    queryKey: ['leaderboard', 'daily', dailyPuzzle?.puzzleId], 
    queryFn: () => getDailyLeaderboard(dailyPuzzle!.puzzleId),
    enabled: !!dailyPuzzle?.puzzleId // Only run when we have a puzzle ID
  });

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="flex flex-1 flex-col gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Рейтинги</h1>
        <h2 className="text-sm font-semibold opacity-70">Топ игроков сегодня</h2>
        <ul className="space-y-2">
          {leaderboard?.entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold opacity-70">#{entry.rank}</span>
                <span className="font-medium">{entry.displayName}</span>
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
