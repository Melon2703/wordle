'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getUserPurchases, refundPurchase, type Purchase } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Button, Card, Heading, Text, Badge } from '@/components/ui';
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Завершена';
      case 'refunded': return 'Возвращена';
      case 'pending': return 'Ожидает';
      case 'failed': return 'Неудачна';
      default: return status;
    }
  };

  const getStatusVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'paid': return 'success';
      case 'refunded': return 'danger';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  // Show loading state while Telegram is initializing or data is loading
  if (!isTelegramReady) {
    return <LoadingFallback length={5} />;
  }

  if (isLoading) {
    return <LoadingFallback length={5} />;
  }

  return (
    <main className="page-container">
      <section className="section-container">
        <Heading level={2}>Покупки</Heading>
        {purchases && purchases.length > 0 ? (
          <div className="card-gap">
            {purchases.map((purchase: Purchase) => (
              <Card key={purchase.purchase_id} padding="md">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Heading level={3}>
                        {purchase.products?.title_ru || 'Неизвестный товар'}
                      </Heading>
                      <Badge 
                        variant={getStatusVariant(purchase.status)} 
                        size="sm"
                      >
                        {getStatusText(purchase.status)}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <Text variant="caption">⭐ {purchase.stars_amount} звезд</Text>
                      <Text variant="caption">ID покупки: {purchase.purchase_id}</Text>
                      <Text variant="caption">Дата: {new Date(purchase.created_at).toLocaleDateString('ru-RU')}</Text>
                      {purchase.telegram_invoice_id && (
                        <Text variant="caption">ID счета: {purchase.telegram_invoice_id}</Text>
                      )}
                      {purchase.completed_at && (
                        <Text variant="caption">Завершена: {new Date(purchase.completed_at).toLocaleDateString('ru-RU')}</Text>
                      )}
                      {purchase.refunded_at && (
                        <Text variant="caption">Возвращена: {new Date(purchase.refunded_at).toLocaleDateString('ru-RU')}</Text>
                      )}
                    </div>
                  </div>
                  {purchase.status === 'paid' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRefund(
                        purchase.purchase_id, 
                        purchase.products?.title_ru || 'Неизвестный товар',
                        purchase.stars_amount
                      )}
                      disabled={refundMutation.isPending}
                      className="ml-3"
                    >
                      {refundMutation.isPending ? 'Возврат...' : 'Вернуть'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="dashed" padding="lg" className="text-center">
            <Text variant="caption">У вас пока нет покупок</Text>
          </Card>
        )}
      </section>
    </main>
  );
}
