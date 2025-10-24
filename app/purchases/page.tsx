'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { GameHeader } from '@/components/GameHeader';
import { getUserPurchases, refundPurchase, type Purchase } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { popup, hapticFeedback } from '@tma.js/sdk';

export default function PurchasesPage() {
  const [isTelegramReady, setIsTelegramReady] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Wait for Telegram WebApp to be ready
  useEffect(() => {
    const checkTelegramReady = () => {
      const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
      if (tg && tg.initData) {
        console.log('✅ Purchases Page - Telegram WebApp is ready');
        setIsTelegramReady(true);
      } else {
        console.log('⏳ Purchases Page - Waiting for Telegram WebApp...');
        setTimeout(checkTelegramReady, 100);
      }
    };

    checkTelegramReady();
  }, []);

  const { data: purchases, isLoading } = useQuery({ 
    queryKey: ['purchases'], 
    queryFn: getUserPurchases,
    enabled: isTelegramReady,
    staleTime: 30 * 1000 // 30 seconds
  });

  const refundMutation = useMutation({
    mutationFn: refundPurchase,
    onSuccess: (data) => {
      console.log('✅ Refund successful:', data);
      
      // Haptic feedback for success
      if (hapticFeedback.isSupported()) {
        hapticFeedback.notificationOccurred('success');
      }
      
      notify('Возврат обработан успешно');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: (error) => {
      console.error('❌ Refund failed:', error);
      
      // Haptic feedback for error
      if (hapticFeedback.isSupported()) {
        hapticFeedback.notificationOccurred('error');
      }
      
      notify('Ошибка при обработке возврата');
    }
  });

  const handleRefund = async (purchaseId: string, productTitle: string, starsAmount: number) => {
    console.log('💸 Refund Debug - Starting refund for purchase:', purchaseId);
    
    // Haptic feedback for button press
    if (hapticFeedback.isSupported()) {
      hapticFeedback.impactOccurred('medium');
    }
    
    // Check if popup is supported
    if (!popup.isSupported()) {
      console.log('❌ Popup not supported, using fallback confirmation');
      if (confirm('Вы уверены, что хотите вернуть эту покупку?')) {
        refundMutation.mutate(purchaseId);
      }
      return;
    }
    
    try {
      // Use standard browser confirmation for now
      const confirmed = confirm(`Вы уверены, что хотите вернуть "${productTitle}" за ⭐ ${starsAmount}?`);
      
      console.log('💸 Refund Debug - Confirmation result:', confirmed);
      
      if (confirmed) {
        console.log('✅ Refund confirmed, processing...');
        refundMutation.mutate(purchaseId);
      } else {
        console.log('❌ Refund cancelled by user');
        notify('Возврат отменен');
      }
      
    } catch (error) {
      console.error('❌ Refund popup error:', error);
      // Fallback to standard confirmation
      if (confirm('Вы уверены, что хотите вернуть эту покупку?')) {
        refundMutation.mutate(purchaseId);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'refunded': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Завершена';
      case 'refunded': return 'Возвращена';
      case 'pending': return 'Ожидает';
      case 'failed': return 'Неудачна';
      default: return status;
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
      <GameHeader title="Покупки" subtitle="История и возвраты" backHref="/" />
      <section className="flex flex-1 flex-col gap-4 px-4 py-6">
        {!isTelegramReady ? (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            Инициализация Telegram...
          </p>
        ) : isLoading ? (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            Загрузка покупок...
          </p>
        ) : purchases && purchases.length > 0 ? (
          <div className="space-y-3">
            {purchases.map((purchase: Purchase) => (
              <div
                key={purchase.purchase_id}
                className="rounded-2xl border border-blue-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm">
                        {purchase.products?.title_ru || 'Неизвестный товар'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(purchase.status)}`}>
                        {getStatusText(purchase.status)}
                      </span>
                    </div>
                    <div className="text-xs opacity-70 space-y-1">
                      <div>⭐ {purchase.stars_amount} звезд</div>
                      <div>ID покупки: {purchase.purchase_id}</div>
                      <div>Дата: {new Date(purchase.created_at).toLocaleDateString('ru-RU')}</div>
                      {purchase.telegram_invoice_id && (
                        <div>ID счета: {purchase.telegram_invoice_id}</div>
                      )}
                      {purchase.completed_at && (
                        <div>Завершена: {new Date(purchase.completed_at).toLocaleDateString('ru-RU')}</div>
                      )}
                      {purchase.refunded_at && (
                        <div>Возвращена: {new Date(purchase.refunded_at).toLocaleDateString('ru-RU')}</div>
                      )}
                    </div>
                  </div>
                  {purchase.status === 'paid' && (
                    <button
                      onClick={() => handleRefund(
                        purchase.purchase_id, 
                        purchase.products?.title_ru || 'Неизвестный товар',
                        purchase.stars_amount
                      )}
                      disabled={refundMutation.isPending}
                      className="ml-3 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {refundMutation.isPending ? 'Возврат...' : 'Вернуть'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-70">
            У вас пока нет покупок
          </p>
        )}
      </section>
    </main>
  );
}
