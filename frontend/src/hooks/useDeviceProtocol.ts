"use client";
import { useState, useEffect } from 'react';

export type DeviceProtocol = 'ios' | 'android' | 'web-operative';

export function useDeviceProtocol() {
  const [protocol, setProtocol] = useState<DeviceProtocol>('web-operative');
  const [carrier, setCarrier] = useState('ZENVY_CONSOLE');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      setProtocol('ios');
      setCarrier('ZENVY_APPLE_LINK');
    } else if (isAndroid) {
      setProtocol('android');
      setCarrier('ZENVY_DROID_MESH');
    } else {
      setProtocol('web-operative');
      setCarrier('ZENVY_CONSOLE_X');
    }
  }, []);

  return { protocol, carrier };
}
