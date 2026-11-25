import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Rewards live in Deals & spin (app/deals, opened from Profile's "Spin & deals" since 25 Nov 2026): spin wheel,
 * coupons, daily deals, ZenPoints, wallet and referral in one place. Every old entry point (checkout,
 * notifications, banners) still opens /rewards and lands there; /rewards?spin=1 opens the spin page
 * (Deals & spin v2, app/deals/spin).
 */
export default function RewardsScreen() {
  const { spin } = useLocalSearchParams<{ spin?: string }>();
  const href = spin ? '/deals/spin' : '/deals';
  return <Redirect href={href as any} />;
}
