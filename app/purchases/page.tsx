'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getUserPurchases, refundPurchase, type Purchase } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Button, Card, Heading, Text, Badge } from '@/components/ui';
import { popup, hapticFeedback } from '@tma.js/sdk';
import { trackEvent } from '@/lib/analytics';
import { useTelegramReady } from '@/lib/hooks/useTelegramReady';

export default function PurchasesPage() {
  const { isTelegramReady } = useTelegramReady();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const purchasesLoadedRef = useRef(false);
  const pendingRefundRef = useRef<{ purchaseId: string; starsAmount: number } | null>(null);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchases'],
    queryFn: getUserPurchases,
    enabled: isTelegramReady,
    staleTime: 30 * 1000 // 30 seconds
  });

  const refundMutation = useMutation({
    mutationFn: refundPurchase,
    onSuccess: () => {
      // Haptic feedback for success
      if (hapticFeedback.isSupported()) {
        hapticFeedback.notificationOccurred('success');
      }

      notify('Возврат обработан успешно');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      if (pendingRefundRef.current) {
        trackEvent('purchase_refund_result', {
          mode: 'purchases',
          purchase_id: pendingRefundRef.current.purchaseId,
          outcome: 'success'
        });
      }
    },
    onError: () => {
      // Haptic feedback for error
      if (hapticFeedback.isSupported()) {
        hapticFeedback.notificationOccurred('error');
      }

      notify('Ошибка при обработке возврата');
      if (pendingRefundRef.current) {
        trackEvent('purchase_refund_result', {
          mode: 'purchases',
          purchase_id: pendingRefundRef.current.purchaseId,
          outcome: 'error'
        });
      }
    },
    onSettled: () => {
      pendingRefundRef.current = null;
    }
  });

  useEffect(() => {
    if (!purchases || purchasesLoadedRef.current) {
      return;
    }
    purchasesLoadedRef.current = true;
    trackEvent('purchases_loaded', {
      mode: 'purchases',
      purchase_count: purchases.length
    });
  }, [purchases]);

  const handleRefund = async (purchaseId: string, productTitle: string, starsAmount: number) => {
    // Haptic feedback for button press
    if (hapticFeedback.isSupported()) {
      hapticFeedback.impactOccurred('medium');
    }

    trackEvent('purchase_refund_clicked', {
      mode: 'purchases',
      purchase_id: purchaseId,
      stars_amount: starsAmount
    });

    // Check if popup is supported
    if (!popup.isSupported()) {
      if (confirm('Вы уверены, что хотите вернуть эту покупку?')) {
        pendingRefundRef.current = { purchaseId, starsAmount };
        trackEvent('purchase_refund_confirmed', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
        refundMutation.mutate(purchaseId);
      } else {
        trackEvent('purchase_refund_cancelled', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
      }
      return;
    }

    try {
      // Use standard browser confirmation for now
      const confirmed = confirm(`Вы уверены, что хотите вернуть "${productTitle}" за ⭐ ${starsAmount}?`);

      if (confirmed) {
        pendingRefundRef.current = { purchaseId, starsAmount };
        trackEvent('purchase_refund_confirmed', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
        refundMutation.mutate(purchaseId);
      } else {
        notify('Возврат отменен');
        trackEvent('purchase_refund_cancelled', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
      }

    } catch (error) {
      console.error('Refund confirmation error');
      // Fallback to standard confirmation
      if (confirm('Вы уверены, что хотите вернуть эту покупку?')) {
        pendingRefundRef.current = { purchaseId, starsAmount };
        trackEvent('purchase_refund_confirmed', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
        refundMutation.mutate(purchaseId);
      } else {
        trackEvent('purchase_refund_cancelled', {
          mode: 'purchases',
          purchase_id: purchaseId
        });
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
