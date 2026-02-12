'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getShopCatalog } from '@/lib/api';
import { useToast } from '@/components/ToastCenter';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Button, Card, Heading, Text, Badge } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { useTelegramReady } from '@/lib/hooks/useTelegramReady';
import { executePurchaseFlow } from '@/lib/purchase';

export default function ShopPage() {
  const { isTelegramReady } = useTelegramReady();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const readyLoggedRef = useRef(false);
  const catalogLoggedRef = useRef(false);

  useEffect(() => {
    if (!isTelegramReady || readyLoggedRef.current) {
      return;
    }
    readyLoggedRef.current = true;
    trackEvent('shop_ready_state', { mode: 'shop', ready: true });
  }, [isTelegramReady]);

  const { data, isLoading } = useQuery({
    queryKey: ['shop', 'catalog'],
    queryFn: getShopCatalog,
    enabled: isTelegramReady
  });

  useEffect(() => {
    if (!data || catalogLoggedRef.current) {
      return;
    }
    catalogLoggedRef.current = true;
    trackEvent('shop_catalog_loaded', {
      mode: 'shop',
      product_count: data.products.length
    });
  }, [data]);

  const handlePurchase = async (productId: string) => {
    setIsPurchasing(true);
    try {
      trackEvent('shop_product_clicked', {
        mode: 'shop',
        product_id: productId
      });

      const outcome = await executePurchaseFlow(productId, {
        eventName: 'shop_purchase_result',
        eventParams: { mode: 'shop', product_id: productId },
        onPaid: () => {
          notify('Покупка завершена успешно!');
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
        },
        onCancelled: () => {
          notify('Покупка отменена');
        }
      });

      if (outcome === 'failed') {
        notify('Ошибка при покупке');
      }
    } finally {
      setIsPurchasing(false);
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
              disabled={isPurchasing}
              className="mt-4"
            >
              {isPurchasing ? 'Покупка...' : 'Получить'}
            </Button>
          </Card>
        ))}
      </section>
    </main>
  );
}
