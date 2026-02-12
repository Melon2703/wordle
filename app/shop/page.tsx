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
        setIsTelegramReady(true);
      } else {
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
    onSuccess: () => {
      notify('Покупка завершена успешно!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    },
    onError: () => {
      notify('Ошибка при покупке');
    }
  });

  const handlePurchase = async (productId: string) => {
    try {
      // First, create the purchase record via API
      const purchaseResult = await purchaseProduct(productId);
      
      // Use the real invoice URL from Telegram Bot API
      const invoiceUrl = purchaseResult.invoice_url;
      
      // Open the invoice using TMA.js SDK (correct method for invoice links)
      const result = await invoice.openUrl(invoiceUrl);
      
      if (result === 'paid') {
        notify('Покупка завершена успешно!');
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
      } else {
        // Payment was cancelled - clean up the pending purchase
        try {
          await cleanupCancelledPurchase(purchaseResult.purchase_id);
        } catch {
          // Don't fail the whole operation if cleanup fails
        }
        notify('Покупка отменена');
      }
      
    } catch {
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
