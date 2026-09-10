export type TripStatus =
  | "created"
  | "in_transit"
  | "completed"
  | "cancelled";

export type Position = {
  id: number;
  tripId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  receivedAt: string;
  speed: number | null;
  source: "vendor" | "simulator";
  sourceEventId: string | null;
};

export type TripView = {
  trip: {
    id: string;
    referenceNumber: string;
    vehicleId: string;
    vendorId: string;
    driverId: string | null;
    status: TripStatus;
    pickupAddress: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffAddress: string;
    dropoffLatitude: number;
    dropoffLongitude: number;
    scheduledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  vehicle: {
    id: string;
    registrationNumber: string;
    make: string;
    model: string;
    color: string | null;
  };
  customer: { id: string; name: string };
  driver: { id: string; name: string; phone: string | null } | null;
  vendor: { id: string; name: string };
  latestPosition: Position | null;
};

export type VehicleOption = {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  color: string | null;
  customer: { id: string; name: string };
};

export type CustomerOption = {
  id: string;
  name: string;
};

export type VendorOption = {
  id: string;
  name: string;
};

export type DriverOption = {
  id: string;
  name: string;
  phone: string | null;
  externalReference: string | null;
  vendor: { id: string; name: string };
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path?: PropertyKey[]; message?: string }>;
  };
};

export type CreateTripPayload = {
  vehicleId: string;
  vendorId: string;
  referenceNumber?: string;
  scheduledAt?: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
};

export type GoogleMapsLocation = {
  name: string;
  lat: number;
  lng: number;
};

export type GoogleMapsLocationResponse = {
  data: GoogleMapsLocation;
};
