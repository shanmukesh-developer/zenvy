export interface OperatingHours { start?: string; end?: string }

/** Whitelisted store profile kept in the session (never the password hash). */
export interface StoreProfile {
  id: string;
  name: string;
  location?: string;
  imageUrl?: string;
  operatingHours?: OperatingHours | null;
  isOpenNow?: boolean;
  isOffline?: boolean;
  vendorType?: string;
  commissionRate?: number;
  commissionType?: string;
  deliveryTime?: number;
}

/** Live store state from GET /api/users/restaurants/:id or PUT /api/restaurants/:id/open. */
export interface StoreState {
  name?: string;
  location?: string;
  isOpenNow: boolean;
  isOpen: boolean;
  opensAt: string | null;
  closedReason: string | null;
  isOffline: boolean;
  isActive: boolean;
  operatingHours: OperatingHours | null;
  deliveryTime: number | null;
}

export interface OrderItem {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  customizations: string | null;
  isAddOn: boolean;
}

export type OrderStage = 'new' | 'preparing' | 'ready' | 'pickedUp' | 'past';

export interface Order {
  id: string;
  shortId: string;
  status: string;
  stage: OrderStage;
  createdAt: string | null;
  updatedAt: string | null;
  acceptedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  itemCount: number;
  totalPrice: number;
  finalPrice: number;
  deliveryFee: number;
  paymentMethod: string;
  paymentStatus: string | null;
  isCOD: boolean;
  deliveryAddress: string;
  instructions: string[];
  estDuration: number | null;
  cancellationReason: string | null;
  deliveryPartnerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  riderName: string | null;
  riderPhone: string | null;
  /** Card made from a socket event before the full order was fetched. */
  partial?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  category: string;
  isVegetarian: boolean | null;
  isAvailable: boolean;
  outOfStockUntil: string | null;
}

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';
