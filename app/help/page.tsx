import Link from 'next/link';

export default function HelpPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)] px-4 py-12 text-[var(--text)]">
      <h1 className="text-3xl font-semibold">Как играть</h1>
      <p className="mt-4 max-w-2xl text-sm opacity-80">
        Правила, сценарии и требования к интерфейсу описаны в /docs/general/Product_Spec.md и
        /docs/general/User_Flow.md. В разработке мы будем ссылаться на соответствующие разделы.
      </p>
      <ol className="mt-6 space-y-3 text-sm opacity-80">
        <li>1. Загадайте слово и вводите догадки с экранной клавиатуры.</li>
        <li>2. Цвет плиток и иконки подсказывают правильность букв.</li>
        <li>3. В ежедневном режиме у вас 6 попыток и одна загадка для всех.</li>
        <li>4. Аркада даёт гибкую длину слова и отдельный рейтинг.</li>
      </ol>
      <Link href="/" className="mt-8 text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline">
        Вернуться на главную
      </Link>
    </main>
  );
}
