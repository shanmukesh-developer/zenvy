'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export default function AndroidBackButton() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          router.back();
        } else {
          CapacitorApp.exitApp();
        }
      });
      
      return () => {
        CapacitorApp.removeAllListeners();
      };
    }
  }, [router]);

  return null;
}
