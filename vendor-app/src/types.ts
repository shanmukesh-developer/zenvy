export interface OperatingHours { start?: string; end?: string }

/** Whitelisted stall profile kept in the session (never the password hash). */
export interface StoreProfile {
  id: string;
  name: string;
  location?: string;
  imageUrl?: string;
  campus?: string | null;
  operatingHours?: OperatingHours | null;
  isOpenNow?: boolean;
  vendorType?: string;
  whatsappNumber?: string;
  phone?: string;
}

/** Live shop state from GET /api/users/restaurants/:id or PUT /api/restaurants/:id/open. */
export interface StoreState {
  name?: string;
  location?: string;
  isOpenNow: boolean;
  isOpen: boolean;
  opensAt: string | null;
  closedReason: string | null;
  isActive: boolean;
  operatingHours: OperatingHours | null;
}

export interface OrderItem {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  customizations: string | null;
}

/** Vendor flow: Pending → Accepted → OutForDelivery → Delivered (or Cancelled). */
export type OrderStage = 'new' | 'accepted' | 'outForDelivery' | 'done';

export interface Order {
  id: string;
  shortId: string;
  status: string;
  stage: OrderStage;
  createdAt: string | null;
  updatedAt: string | null;
  acceptedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  items: OrderItem[];
  itemCount: number;
  /** Item total. */
  totalPrice: number;
  /** What the customer pays (items + any fees − discounts). */
  finalPrice: number;
  paymentMethod: string;
  isCOD: boolean;
  /** Cash the vendor collects at the door (0 when already paid). */
  collectAmount: number;
  /** Delivery address without the "Note: …" parts. Shown on screen, never spoken. */
  deliveryAddress: string;
  hostelBlock: string | null;
  roomNumber: string | null;
  instructions: string[];
  cancellationReason: string | null;
  /** Full customer name (owning vendor only). */
  customerName: string | null;
  customerPhone: string | null;
  /** Card built from a socket event before the full order was fetched. */
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
}

/** What the add / edit item form sends to the store. */
export interface ItemInput {
  name: string;
  price: number;
  category: string;
  isVegetarian: boolean;
  description: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export type ConnStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';
