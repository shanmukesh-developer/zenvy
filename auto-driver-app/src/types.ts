// Shapes returned by the driver API (backend/modules/autoRide/services/serialize.js). Keep in sync:
// the verification script checks every key listed here against the live routers.

export type DriverStatus = 'PENDING_DOCS' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type VehicleStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type TripStatus =
  | 'DRAFT' | 'PUBLISHED' | 'OPEN_FOR_BOOKING' | 'DEPARTURE_THRESHOLD_REACHED' | 'FULL' | 'DRIVER_CONFIRMED'
  | 'BOARDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED' | 'CANCELLED' | 'NO_SHOW' | 'DRIVER_UNAVAILABLE' | 'VEHICLE_UNAVAILABLE';
export type BookingStatus = 'HELD' | 'CONFIRMED' | 'BOARDED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'NO_SHOW' | 'REFUND_PENDING' | 'REFUNDED';
export type PrivateStatus = 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'CONFLICT' | 'EXPIRED' | 'CANCELLED';
export type Availability = 'NOT_OPEN' | 'AVAILABLE' | 'FILLING_FAST' | 'READY_TO_DEPART' | 'FULL' | 'PRIVATE' | 'DEPARTING' | 'BOARDING' | 'DELAYED' | 'IN_PROGRESS' | 'CLOSED';

export const DRIVER_DOC_KEYS = ['photo', 'licenceFront', 'licenceBack', 'badge', 'policeVerification'] as const;
export type DriverDocKey = typeof DRIVER_DOC_KEYS[number];
export const REQUIRED_DRIVER_DOCS: DriverDocKey[] = ['photo', 'licenceFront', 'licenceBack'];
export const VEHICLE_DOC_KEYS = ['rc', 'permit', 'insurance', 'fitness', 'puc'] as const;
export type VehicleDocKey = typeof VEHICLE_DOC_KEYS[number];
export const REQUIRED_VEHICLE_DOCS: VehicleDocKey[] = ['rc', 'permit', 'insurance'];
export const FUELS = ['CNG', 'PETROL', 'DIESEL', 'LPG', 'EV'] as const;
export const INCIDENT_CATEGORIES = ['SAFETY', 'HARASSMENT', 'OVERCHARGE', 'RASH_DRIVING', 'NO_SHOW', 'VEHICLE_ISSUE', 'PAYMENT', 'LOST_ITEM', 'OTHER'] as const;
export type IncidentCategory = typeof INCIDENT_CATEGORIES[number];

export interface DriverSelf {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
  rejectionReason: string | null;
  suspendedReason: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  licenceNumber: string | null;
  licenceExpiresOn: string | null;
  badgeNumber: string | null;
  documents: Partial<Record<DriverDocKey, string>>;
  documentPreviews: Partial<Record<DriverDocKey, string | null>>;
  preferredRouteIds: string[];
  isOnline: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

/** Layout cell: 'D' driver seat, null gap, number = passenger seat. */
export type LayoutCell = number | 'D' | null;
export interface SeatLayout { rows: LayoutCell[][] }

export interface Vehicle {
  id: string;
  driverId: string;
  registration: string | null;
  registrationNumber: string;
  make: string | null; model: string | null; year: number | null; fuel: string | null; colour: string | null;
  rcSeatingCapacity: number; requestedCapacity: number; approvedCapacity: number | null;
  seatLayout: SeatLayout | null;
  permitNumber: string | null;
  permitExpiresOn: string | null; insuranceExpiresOn: string | null; fitnessExpiresOn: string | null; pucExpiresOn: string | null;
  documents: Partial<Record<VehicleDocKey, string>>;
  documentPreviews: Partial<Record<VehicleDocKey, string | null>>;
  photos: string[];
  photoPreviews: (string | null)[];
  status: VehicleStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
}

export interface MeResponse {
  driver: DriverSelf;
  vehicles: Vehicle[];
  canPublish: boolean;
  featureEnabled: boolean;
  /** e.g. 'document:photo', 'licenceNumber', 'vehicle' */
  missing: string[];
}

export interface PickupBrief { id: string; name: string; landmark: string | null; lat: number | null; lon: number | null; mapsUrl: string | null }
export interface RouteBrief { id: string; name: string; origin: string; destination: string; distanceKm: number | null }
export interface OperatingPeriod { key: string; label?: string; start: string; end: string }
export interface RouteFull extends RouteBrief {
  campusId: string | null;
  seatFareMin: number | null; seatFareMax: number | null; fullFareMin: number | null; fullFareMax: number | null;
  operatingPeriods: OperatingPeriod[];
  minSeatsToDepartDefault: number | null;
  permittedStops: string[];
  isActive: boolean;
  sortOrder: number;
  pickupPoints: (PickupBrief & { routeId: string; sequence: number; isActive: boolean })[];
}

/** serialize.tripStatus(): the one status block both apps get. */
export interface TripStatusBlock {
  status: TripStatus;
  statusLabel: string;
  availability: Availability;
  availabilityLabel: string;
  mode: 'SHARED' | 'PRIVATE';
  capacity: number;
  confirmedSeats: number;
  heldSeats: number;
  boardedSeats: number;
  remainingSeats: number;
  minSeatsToDepart: number;
  queueNumber: number | null;
  departureAt: string | null;
  originalDepartureAt: string | null;
  delayMinutes: number;
  version: number;
}

export interface Trip extends TripStatusBlock {
  id: string;
  route: RouteBrief | null;
  pickup: PickupBrief | null;
  vehicle: { id: string; registration: string | null; approvedCapacity: number | null } | null;
  routeId: string;
  pickupPointId: string;
  vehicleId: string;
  destination: string | null;
  stops: string[];
  seatFare: number;
  fullAutoFare: number | null;
  extraCharges?: ExtraCharges | null;
  seatSelectionEnabled: boolean;
  privateBookingEnabled: boolean;
  seatLayout: SeatLayout | null;
  bookingOpensAt: string | null;
  operatingDate: string | null;
  periodKey: string | null;
  publishedAt: string | null;
  confirmedAt: string | null;
  boardingAt: string | null;
  startedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  delayReason: string | null;
  createdAt: string | null;
}

export interface BookingDriver {
  id: string;
  bookingCode: string;
  tripId: string;
  type: 'SHARED' | 'PRIVATE';
  seatCount: number;
  seatNumbers: number[];
  status: BookingStatus;
  paymentMethod: 'CASH' | 'WALLET' | null;
  paymentStatus: string | null;
  amount: number;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  boardedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  passengerName: string;
  passengerCount: number;
  cashToCollect: number;
  cashCollectedAt: string | null;
}

export type SeatState = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNAVAILABLE' | 'MINE' | 'MINE_HELD';
export interface SeatMapResponse extends TripStatusBlock {
  tripId: string;
  layout: SeatLayout;
  seats: { seatNo: number; state: SeatState }[];
  legend: string[];
}

export interface PrivateRequest {
  id: string;
  tripId: string;
  status: PrivateStatus;
  passengers: number;
  purpose: string | null;
  fare: number;
  /** fare = baseFare + extraCharges.amount. */
  baseFare?: number;
  extraCharges?: ExtraCharges | null;
  paymentMethod: string;
  respondBy: string | null;
  respondedAt: string | null;
  passengerName: string;
  bookingId: string | null;
  createdAt: string | null;
}

export interface DriverNotification {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: any;
  readAt: string | null;
  createdAt: string | null;
}

export interface Earnings { cashCollected: number; walletPayments: number; total: number; note: string }

export interface HomeResponse {
  driver: { id: string; name: string; status: DriverStatus; isOnline: boolean };
  currentTrip: Trip | null;
  todayTrips: (TripStatusBlock & { id: string })[];
  todayEarnings: Earnings;
  pendingPrivateRequests: number;
  settings?: DriverSettings;
  alerts: { type: string; message: string }[];
}

/** GET /driver/pickup-points/:id/queue (same trip cards as the customer queue; no passenger data). */
export interface QueueEntry extends TripStatusBlock {
  id: string;
  driver: { name: string; verified: boolean; photo: string | null } | null;
  vehicle: { registration: string | null; registrationMasked: boolean } | null;
  destination: string | null;
  seatFare: number;
  periodKey: string | null;
  checkInAt: string | null;
  mine: boolean;
}
export interface QueueResponse {
  pickupPoint: { id: string; name: string; landmark: string | null; lat: number | null; lon: number | null; mapsUrl: string | null };
  date: string;
  queue: QueueEntry[];
  note: string;
}

export interface Incident {
  id: string; tripId: string | null; bookingId: string | null; reporterType: string; category: string;
  description: string | null; status: string; adminNote: string | null; createdAt: string | null; resolvedAt: string | null;
  priority?: 'NORMAL' | 'HIGH';
}

export interface MediaUpload { id: string; url: string; previewUrl: string | null; mime: string; size: number; isPrivate: boolean }

/** Trip draft / publish form (POST /trips, PATCH /trips/:id). */
export interface ExtraCharges { amount: number; note: string | null }

/** GET /driver/settings (also /home settings): limits the server enforces. */
export interface DriverSettings {
  platformMaxCapacity: number;
  maxAdvanceDays: number;
  holdMinutes: number;
  maxSeatsPerBooking: number;
  refundBeforeDriverConfirmPct: number;
  refundAfterDriverConfirmPct: number;
  privateRespondMinutes?: number;
  walletEnabled: boolean;
}

export interface TripInput {
  vehicleId: string;
  routeId: string;
  pickupPointId: string;
  departureAt: string;
  bookingOpensAt?: string | null;
  capacity: number;
  seatFare: number;
  fullAutoFare?: number | null;
  /** Optional full-auto extra charges (null clears). Bounded by the server. */
  extraCharges?: ExtraCharges | null;
  privateBookingEnabled: boolean;
  seatSelectionEnabled: boolean;
  minSeatsToDepart?: number;
  stops?: string[];
}

export interface VehicleInput {
  registrationNumber?: string;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  year?: number | null;
  fuel?: string | null;
  rcSeatingCapacity?: number;
  requestedCapacity?: number;
  permitNumber?: string | null;
  permitExpiresOn?: string | null;
  insuranceExpiresOn?: string | null;
  fitnessExpiresOn?: string | null;
  pucExpiresOn?: string | null;
  documents?: Partial<Record<VehicleDocKey, string | null>>;
  photos?: string[];
}

export interface ProfileInput {
  name?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  licenceNumber?: string | null;
  licenceExpiresOn?: string | null;
  badgeNumber?: string | null;
  preferredRouteIds?: string[];
}

export type DriverAction = 'confirm-departure' | 'start-boarding' | 'start' | 'arrive' | 'complete' | 'delay' | 'resume' | 'cancel' | 'unavailable';
