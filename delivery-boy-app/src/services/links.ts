// Leave the app for navigation, calls and WhatsApp.
import { Linking, Platform } from 'react-native';
import { digitsOnly, isDialable } from './orderModel';

export interface Destination {
  coords?: { lat: number; lng: number } | null;
  address?: string | null;
}

export async function openNavigation(dest: Destination): Promise<boolean> {
  const c = dest.coords;
  if (c) {
    if (Platform.OS === 'android') {
      const nav = `google.navigation:q=${c.lat},${c.lng}&mode=l`; // l = two-wheeler
      try {
        await Linking.openURL(nav);
        return true;
      } catch {
        // fall through to the web URL
      }
    }
    return tryOpen(`https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=two-wheeler`);
  }
  const address = (dest.address || '').trim();
  if (!address) return false;
  return tryOpen(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=two-wheeler`);
}

export async function call(phone: string | null | undefined): Promise<boolean> {
  if (!isDialable(phone)) return false;
  return tryOpen(`tel:+91${digitsOnly(phone).slice(-10)}`);
}

export async function callNumber(number: string): Promise<boolean> {
  return tryOpen(`tel:${number}`);
}

export async function whatsapp(phone: string | null | undefined, text: string): Promise<boolean> {
  if (!isDialable(phone)) return false;
  const d = digitsOnly(phone).slice(-10);
  return tryOpen(`https://wa.me/91${d}?text=${encodeURIComponent(text)}`);
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
