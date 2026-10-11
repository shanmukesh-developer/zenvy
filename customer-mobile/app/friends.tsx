import React from 'react';
import { useRouter } from 'expo-router';
import { CampusShell } from '../modules/campus/CampusShell';

/**
 * Campus Buddy (formerly Friends Section)
 * Comprehensive Campus Community & WhatsApp-grade Chat System
 */
export default function FriendsScreen() {
  const router = useRouter();

  // Opened from a notification / deep link there may be no screen to go back to.
  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as any);
  };

  return <CampusShell onBack={handleBack} />;
}
