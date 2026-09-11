import { z } from "zod";
import { tripStatuses } from "@/db/schema";

const coordinatesSchema = z.object({
  address: z.string().trim().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const createTripSchema = z.object({
  vehicleId: z.uuid(),
  vendorId: z.uuid(),
  referenceNumber: z.string().trim().min(1).max(100).optional(),
  pickup: coordinatesSchema,
  dropoff: coordinatesSchema,
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
});

export const updateTripSchema = z.union([
  z.object({ status: z.enum(tripStatuses) }),
  z.object({ driverId: z.uuid() }),
]);

export const ingestLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  timestamp: z.iso.datetime({ offset: true }),
  speed: z.number().nonnegative().optional(),
  eventId: z.string().trim().min(1).max(200).optional(),
});

export const listTripsQuerySchema = z.object({
  status: z.enum(tripStatuses).optional(),
  vendorId: z.uuid().optional(),
  driverId: z.uuid().optional(),
});

export const simulationRequestSchema = z.object({
  intervalMs: z.number().int().min(1_000).max(60_000).optional(),
  stepMeters: z.number().int().min(100).max(20_000).optional(),
});

export const resolveGoogleMapsLinkSchema = z.object({
  url: z.string().trim().min(1).max(4_096),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type IngestLocationInput = z.infer<typeof ingestLocationSchema>;
export type SimulationRequest = z.infer<typeof simulationRequestSchema>;
export type ResolveGoogleMapsLinkInput = z.infer<
  typeof resolveGoogleMapsLinkSchema
>;
