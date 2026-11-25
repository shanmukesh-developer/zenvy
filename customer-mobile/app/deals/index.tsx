/**
 * Deals & spin v2 · home (modules/dealsV2): the spin wheel hero, ZenPoints, today's deals and your coupons.
 * Owner, 25 Nov 2026: Deals & spin left the Groceries tab and opens from Profile ("Spin & deals", next to Your
 * coupons). Every older link (/rewards, /(tabs)/others?tab=promos or ?tab=offers) lands here.
 */
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { DV } from '../../modules/dealsV2/dealsV2Theme';
import DealsV2Home from '../../modules/dealsV2/DealsV2Screen';
import StatusBarScrim from '../../components/StatusBarScrim';

export default function DealsHomeRoute() {
  const router = useRouter();
  // Outside the Groceries tab there are no section pills; "Saved items" and "Shop" still open Food & groceries.
  const onSection = useCallback((key: string) => {
    router.push(`/(tabs)/others?tab=${encodeURIComponent(key)}` as any);
  }, [router]);
  return (
    <View style={{ flex: 1, backgroundColor: DV.page }}>
      <DealsV2Home onSection={onSection} />
      <StatusBarScrim color={DV.header[0]} />
    </View>
  );
}
