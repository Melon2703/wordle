import Link from 'next/link';

const cards = [
  {
    href: '/daily',
    title: 'Ежедневная загадка',
    description: 'Одна загадка в день, следите за серией и рейтингом.'
  },
  {
    href: '/arcade',
    title: 'Аркада',
    description: 'Неограниченные попытки и гибкая длина слов.'
  },
  {
    href: '/leaders',
    title: 'Рейтинги',
    description: 'Посмотрите своё место и результаты друзей.'
  },
  {
    href: '/shop',
    title: 'Магазин',
    description: 'Подписки, косметика и билеты за Telegram Stars.'
  }
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[var(--bg)] px-4 pb-16 pt-12 text-[var(--text)]">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">RU Word Puzzle</h1>
        <p className="max-w-md text-sm opacity-80">
          Выберите режим, чтобы начать. Правила и UX описаны в /docs — реализация будет
          дорабатываться по плану.
        </p>
      </div>
      <section className="grid gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-3xl border border-[color:var(--tile-border)] bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm opacity-70">{card.description}</p>
          </Link>
        ))}
      </section>
      <Link
        href="/help"
        className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
      >
        Как играть и подсказки по орфографии
      </Link>
    </main>
  );
}
