// ── Rider app domain types ─────────────────────────────────────────────────

export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'Preparing'
  | 'ReadyForPickup'
  | 'Picking'
  | 'PickedUp'
  | 'ArrivedAtGate'
  | 'Delivered'
  | 'Cancelled';

export type PaymentMethod = 'COD' | 'Wallet' | 'UPI' | 'Card';

export interface RiderOrderItem {
  name: string;
  quantity: number;
  price: number | null;
}

/** One order as the rider app uses it. Unknown values are null, never invented. */
export interface RiderOrder {
  id: string;
  shortId: string;
  status: OrderStatus;
  restaurantName: string | null;
  restaurantAddress: string | null;
  restaurantPhone: string | null;
  pickupCoords: { lat: number; lng: number } | null;
  customerName: string | null;
  customerPhone: string | null;
  dropAddress: string | null;
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
  /** Cash collected at the door today (only from servers that send it). */
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
  /** 'server' = GET /delivery/stats/week, 'history' = computed from the last 100 deliveries */
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

// ── Legacy types (only used by the old, no longer imported src/components/*) ──

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  restaurant?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
}

export interface PickupStop {
  restaurantName: string;
  address: string;
  phone: string;
  items: OrderItem[];
}

/** @deprecated legacy shape used by the old components; the app uses RiderOrder. */
export interface Order {
  id: string;
  _id?: string;
  restaurant: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  customerName: string;
  customerPhone?: string;
  drop: string;
  items: OrderItem[];
  totalPrice?: number;
  finalPrice?: number;
  status: string;
  /** The server never sends the PIN to riders. */
  hasDeliveryPin?: boolean;
  createdAt?: string;
  deliveredAt?: string;
  earnings?: string;
  riderEarning?: number;
  deliveryFee?: number;
  note?: string;
  deliverySlot?: string;
  category?: string;
  isBulk?: boolean;
  isMegaBasket?: boolean;
  user?: { name?: string; phone?: string; [key: string]: any };
  megaBasketStep?: 'SHOPPING_AT_STORE' | 'BILL_UPLOADED' | 'PAYMENT_CONFIRMED' | 'DELIVERING_TO_APARTMENT';
  billProofUrl?: string;
  billAmount?: number;
  isBillApproved?: boolean;
  itemPhotoUrl?: string;
  isPurchasingApprovedByCustomer?: boolean;
  pickupStops?: PickupStop[];
  isMultiRestaurant?: boolean;
  paymentMethod?: string;
}
