'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getShopCatalog, purchaseProduct, cleanupCancelledPurchase } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { invoice } from '@tma.js/sdk';

export default function ShopPage() {
  const [isTelegramReady, setIsTelegramReady] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Wait for Telegram WebApp to be ready
  useEffect(() => {
    const checkTelegramReady = () => {
      const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
      if (tg && tg.initData) {
        console.log('✅ Shop Page - Telegram WebApp is ready');
        setIsTelegramReady(true);
      } else {
        console.log('⏳ Shop Page - Waiting for Telegram WebApp...');
        setTimeout(checkTelegramReady, 100);
      }
    };

    checkTelegramReady();
  }, []);

  const { data } = useQuery({ 
    queryKey: ['shop', 'catalog'], 
    queryFn: getShopCatalog,
    enabled: isTelegramReady // Only run when Telegram is ready
  });

  const purchaseMutation = useMutation({
    mutationFn: purchaseProduct,
    onSuccess: (data) => {
      console.log('✅ Purchase successful:', data);
      notify('Покупка завершена успешно!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      console.error('❌ Purchase failed:', error);
      notify('Ошибка при покупке');
    }
  });

  const handlePurchase = async (productId: string) => {
    console.log('🛒 Shop Page - Starting purchase for:', productId);
    
    try {
      // First, create the purchase record via API
      const purchaseResult = await purchaseProduct(productId);
      console.log('✅ Purchase record created:', purchaseResult);
      
      // Use the real invoice URL from Telegram Bot API
      const invoiceUrl = purchaseResult.invoice_url;
      
      console.log('🛒 Opening Telegram invoice:', invoiceUrl);
      
      // Open the invoice using TMA.js SDK (correct method for invoice links)
      const result = await invoice.openUrl(invoiceUrl);
      console.log('💰 Invoice result:', result);
      
      if (result === 'paid') {
        notify('Покупка завершена успешно!');
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
      } else {
        // Payment was cancelled - clean up the pending purchase
        console.log('❌ Payment cancelled, cleaning up pending purchase');
        try {
          await cleanupCancelledPurchase(purchaseResult.purchase_id);
          console.log('✅ Cleanup successful');
        } catch (cleanupError) {
          console.error('❌ Cleanup failed:', cleanupError);
          // Don't fail the whole operation if cleanup fails
        }
        notify('Покупка отменена');
      }
      
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      notify('Ошибка при покупке');
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="grid flex-1 gap-4 px-4 py-6">
            <h1 className="text-xl font-semibold font-sans">Магазин</h1>
        {!isTelegramReady ? (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            Инициализация Telegram...
          </p>
        ) : data?.products.map((product) => (
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
              onClick={() => handlePurchase(product.id)}
              disabled={purchaseMutation.isPending}
              className="mt-4 w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {purchaseMutation.isPending ? 'Покупка...' : 'Получить'}
            </button>
          </article>
        ))}
        {isTelegramReady && !data ? (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            Каталог загружается…
          </p>
        ) : null}
      </section>
    </main>
  );
}
