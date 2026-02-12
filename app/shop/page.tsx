'use client';

import { useQuery } from '@tanstack/react-query';
import { GameHeader } from '@/components/GameHeader';
import { getShopCatalog } from '@/lib/api';

export default function ShopPage() {
  const { data } = useQuery({ queryKey: ['shop', 'catalog'], queryFn: getShopCatalog });

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
      <GameHeader title="Магазин" subtitle="Цифровые товары за Telegram Stars" backHref="/" />
      <section className="grid flex-1 gap-4 px-4 py-6">
        {data?.products.map((product) => (
          <article
            key={product.id}
            className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{product.title}</h2>
              {product.badge ? (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase">
                  {product.badge}
                </span>
              ) : null}
            </div>
            {product.subtitle ? <p className="mt-2 text-sm opacity-70">{product.subtitle}</p> : null}
            <p className="mt-4 text-sm font-semibold">⭐ {product.priceStars}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Получить
            </button>
          </article>
        ))}
        {!data ? (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            Каталог загружается…
          </p>
        ) : null}
      </section>
    </main>
  );
}
