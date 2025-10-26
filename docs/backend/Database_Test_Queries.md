# Database Test Queries

A reference file with useful SQL queries for quick testing and seeding of the database.

## Arcade Consumables

### TypeScript Type Definitions

Type definitions for 3 arcade consumable items:

```typescript
interface ArcadeHintProduct {
  product_id: 'arcade_hint';
  type: 'ticket';
  title_ru: 'Подсказка в аркаде';
  description_ru: 'Откройте случайную букву';
  price_stars: 15;
  recurring: null;
  badge: 'new' | 'popular' | null;
  active: true;
}

interface ArcadeNewGameProduct {
  product_id: 'arcade_new_game';
  type: 'ticket';
  title_ru: 'Новая игра';
  description_ru: 'Начните новую головоломку';
  price_stars: 8;
  recurring: null;
  badge: null;
  active: true;
}

interface ArcadeExtraTryProduct {
  product_id: 'arcade_extra_try';
  type: 'ticket';
  title_ru: 'Дополнительная попытка';
  description_ru: 'Получите ещё одну попытку';
  price_stars: 20;
  recurring: null;
  badge: null;
  active: true;
}
```

### SQL INSERT Statements for Entitlements

Grant arcade consumable entitlements to test profile `91b76846-4f00-47ad-9a66-9ac95862bf57`:

```sql
-- Grant "New Game" entitlement (allows starting a fresh arcade puzzle)
INSERT INTO public.entitlements (
  profile_id,
  product_id,
  is_equipped,
  granted_at
) VALUES (
  '91b76846-4f00-47ad-9a66-9ac95862bf57',
  'arcade_new_game',
  false,
  now()
);

-- Grant "Hint" entitlement (reveals a random letter in arcade)
INSERT INTO public.entitlements (
  profile_id,
  product_id,
  is_equipped,
  granted_at
) VALUES (
  '91b76846-4f00-47ad-9a66-9ac95862bf57',
  'arcade_hint',
  false,
  now()
);

-- Grant "Extra Try" entitlement (adds one additional attempt to current arcade game)
INSERT INTO public.entitlements (
  profile_id,
  product_id,
  is_equipped,
  granted_at
) VALUES (
  '91b76846-4f00-47ad-9a66-9ac95862bf57',
  'arcade_extra_try',
  false,
  now()
);
```