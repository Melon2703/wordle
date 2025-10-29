'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getShopCatalog, purchaseProduct, cleanupCancelledPurchase } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Button, Card, Heading, Text, Badge } from '@/components/ui';
import { invoice } from '@tma.js/sdk';

export default function ShopPage() {
  const [isTelegramReady, setIsTelegramReady] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  // Wait for Telegram WebApp to provide init data before fetching catalog
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

  const { data, isLoading } = useQuery({ 
    queryKey: ['shop', 'catalog'], 
    queryFn: getShopCatalog,
    enabled: isTelegramReady
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

  if (!isTelegramReady) {
    return <LoadingFallback length={5} />;
  }

  // Show loading state while data is loading
  if (isLoading) {
    return <LoadingFallback length={5} />;
  }

  return (
    <main className="page-container">
      <section className="section-container">
        <Heading level={2}>Магазин</Heading>
        {data?.products.map((product) => (
          <Card key={product.id} padding="md">
            <div className="flex items-center justify-between">
              <Heading level={3}>{product.title}</Heading>
              {product.badge && (
                <Badge variant="info" size="sm" className="uppercase">
                  {product.badge}
                </Badge>
              )}
            </div>
            {product.subtitle && (
              <Text variant="caption" className="mt-2">
                {product.subtitle}
              </Text>
            )}
            <Text className="mt-4 font-semibold">⭐ {product.priceStars}</Text>
            <Button
              fullWidth
              onClick={() => handlePurchase(product.id)}
              disabled={purchaseMutation.isPending}
              className="mt-4"
            >
              {purchaseMutation.isPending ? 'Покупка...' : 'Получить'}
            </Button>
          </Card>
        ))}
      </section>
    </main>
  );
}
