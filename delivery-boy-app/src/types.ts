// Rider app domain types. Unknown values are null, never invented.

export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'ReadyForPickup'
  | 'Picking'
  | 'PickedUp'
  | 'ArrivedAtGate'
  | 'Delivered'
  | 'Cancelled'
  /** A status this app version does not know. The raw value is in RiderOrder.rawStatus. */
  | 'Unknown';

export type PaymentMethod = 'COD' | 'Wallet' | 'UPI' | 'Card';

export interface RiderOrderItem {
  name: string;
  quantity: number;
  price: number | null;
}

export interface RiderOrder {
  id: string;
  shortId: string;
  status: OrderStatus;
  /** Status string exactly as the server sent it (kept so an unknown status is never shown as something else). */
  rawStatus: string | null;
  /**
   * Has the kitchen packed the food? true / false from the server's readyAt (or status ReadyForPickup);
   * null when the server did not say.
   */
  kitchenReady: boolean | null;
  restaurantName: string | null;
  restaurantAddress: string | null;
  restaurantPhone: string | null;
  pickupCoords: { lat: number; lng: number } | null;
  customerName: string | null;
  customerPhone: string | null;
  dropAddress: string | null;
  /** Pool-safe area (campus / hostel block / locality, no room number). Sent before and after accept. */
  dropArea: string | null;
  /** Customer pin; only on active / accepted orders (never in the pool). */
  dropCoords: { lat: number; lng: number } | null;
  instructions: string[];
  items: RiderOrderItem[];
  finalPrice: number | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: string | null;
  amountToCollect: number | null;
  earning: number | null;
  distanceKm: number | null;
  createdAt: string | null;
  deliveredAt: string | null;
  deliverySlot: string | null;
  hasDeliveryPin: boolean;
  pinLocked: boolean;
}

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: string | null;
  vehicleNumber: string | null;
  emergencyContact: string | null;
  photoUrl: string | null;
  isApproved: boolean;
  isOnline: boolean;
  averageRating: number | null;
  totalRatings: number;
  totalEarnings: number | null;
  completedCount: number | null;
  walletBalance: number | null;
}

export interface TodayStats {
  earnings: number;
  orders: number;
  zenPoints?: number;
  streak?: number;
  codCollected?: number;
}

export interface WeekDay {
  date: string; // YYYY-MM-DD (IST)
  earnings: number;
  orders: number;
  codCollected?: number;
}

export interface WeekStats {
  days: WeekDay[];
  totalEarnings: number;
  totalOrders: number;
  /** 'server' = GET /delivery/stats/week, 'history' = computed from recent deliveries */
  source: 'server' | 'history';
}

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
}

export interface Loadable<T> {
  data: T;
  loaded: boolean;
  error: string | null;
  updatedAt: number | null;
}
