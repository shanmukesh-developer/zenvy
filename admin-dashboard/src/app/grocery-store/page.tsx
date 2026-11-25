"use client";

// Grocery store (owner, 26 Nov 2026): ZenWe Grocery, ZenWe's own house store, managed Blinkit-style. Its categories
// are the category tiles of the customer app's Groceries tab > Grocery store, and its products are the only products
// shown there. Backend: /api/admin/house-grocery/* (backend/controllers/houseGroceryController, utils/houseGrocery).
import { useAdminAuth } from '@/utils/useAdminAuth';
import { LoadingState, PageHeader } from '@/components/ui';
import HouseGroceryManager from '@/components/grocery/HouseGroceryManager';

export default function GroceryStorePage() {
  const { isAuthed } = useAdminAuth();
  if (!isAuthed) return <LoadingState />;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Grocery store"
        description="ZenWe Grocery, ZenWe's own store. Its categories are the tiles in the app's Groceries tab > Grocery store, and only its products show there. Orders go straight to ZenWe riders (no partner app) and are delivered in the grocery window."
      />
      <HouseGroceryManager />
    </div>
  );
}
