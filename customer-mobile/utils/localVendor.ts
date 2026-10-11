import { Alert, Linking } from 'react-native';

/**
 * CampusBites local vendors are DISPLAY-ONLY listings. Zenvy shows the stall and its prices;
 * the customer orders directly with the vendor (call / WhatsApp) and the vendor delivers.
 * Zenvy takes no order, payment or rider for them, so their items are never added to the basket.
 * Mirrors backend utils/vendorTypes.js (isLocalVendorStore).
 */
export const LOCAL_VENDOR_TYPES = ['LOCAL_VENDOR', 'LOCAL', 'STALL'];

export const isLocalVendor = (store: any): boolean =>
  !!store && (LOCAL_VENDOR_TYPES.includes(String(store.vendorType || '').toUpperCase()) || store.isLocalVendor === true);

export const isLocalVendorType = (vendorType: any): boolean =>
  LOCAL_VENDOR_TYPES.includes(String(vendorType || '').toUpperCase());

/** Digits with the India country code; null when the number is missing or invalid. */
const toDialable = (raw: any): string | null => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
};

/** The vendor's own WhatsApp number (never a Zenvy number). */
export const vendorWhatsappNumber = (vendor: any): string | null => toDialable(vendor?.whatsappNumber);

/** The vendor's own phone number; their WhatsApp number is also callable. */
export const vendorCallNumber = (vendor: any): string | null => toDialable(vendor?.phone) || toDialable(vendor?.whatsappNumber);

export const callVendor = (vendor: any) => {
  const num = vendorCallNumber(vendor);
  if (!num) return;
  Linking.openURL(`tel:+${num}`).catch(() => Alert.alert("Couldn't open the dialer", `Call +${num} from your phone app.`));
};

export const whatsappVendor = (vendor: any, itemName?: string) => {
  const num = vendorWhatsappNumber(vendor);
  if (!num) return;
  const name = String(vendor?.name || 'your stall');
  const msg = itemName
    ? `Hi ${name}! I found you on Zenvy CampusBites and would like to order ${itemName}.`
    : `Hi ${name}! I found you on Zenvy CampusBites and would like to place an order.`;
  Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`)
    .catch(() => Alert.alert("Couldn't open WhatsApp", 'Make sure WhatsApp is installed, or call the stall instead.'));
};

export const DIRECT_ORDER_COPY = 'Order directly from the stall by call or WhatsApp. The vendor takes your order and delivers it themselves — no Zenvy basket, payment or rider.';
