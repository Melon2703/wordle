'use client';

import { useQuery } from '@tanstack/react-query';
import { GameHeader } from '@/components/GameHeader';
import { getDailyLeaderboard } from '@/lib/api';

export default function LeadersPage() {
  const { data } = useQuery({ queryKey: ['leaderboard', 'daily'], queryFn: getDailyLeaderboard });

  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <GameHeader title="Рейтинги" subtitle="Попытки важнее времени" backHref="/" />
      <section className="flex flex-1 flex-col gap-4 px-4 py-6">
        <h2 className="text-sm font-semibold opacity-70">Топ игроков сегодня</h2>
        <ul className="space-y-2">
          {data?.entries.map((entry) => (
            <li
              key={entry.userId}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--tile-border)] bg-[var(--panel)] px-4 py-3 text-sm"
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
      </section>
    </main>
  );
}
