"use client";

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export default function PushNotificationManager() {
  useEffect(() => {
    // Only register push notifications on native devices
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('User denied push notification permission');
        return;
      }

      await PushNotifications.register();
    };

    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      registerTokenWithBackend(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on push registration: ', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ', notification);
    });

    registerPush();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  const registerTokenWithBackend = async (fcmToken: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return; // User not logged in

      const userStr = localStorage.getItem('user');
      let userId = 'unknown';
      if (userStr) {
        try {
          userId = JSON.parse(userStr).id || JSON.parse(userStr)._id || 'unknown';
        } catch {
          // Ignore parse errors
        }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5005';
      await fetch(`${apiUrl}/api/users/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, fcmToken, appVersion: 'admin' })
      });
      console.log('Registered FCM Token with Backend');
    } catch (e) {
      console.error('Failed to register FCM token with backend', e);
    }
  };

  return null;
}

