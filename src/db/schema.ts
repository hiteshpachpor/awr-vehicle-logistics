import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  ...timestamps,
});

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    registrationNumber: text("registration_number").notNull(),
    vin: text("vin"),
    make: text("make").notNull(),
    model: text("model").notNull(),
    color: text("color"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("vehicles_customer_registration_unique").on(
      table.customerId,
      table.registrationNumber,
    ),
    uniqueIndex("vehicles_vin_unique")
      .on(table.vin)
      .where(sql`${table.vin} is not null`),
  ],
);

export const logisticsVendors = pgTable("logistics_vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const drivers = pgTable(
  "drivers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => logisticsVendors.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone"),
    externalReference: text("external_reference"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("drivers_vendor_external_reference_unique")
      .on(table.vendorId, table.externalReference)
      .where(sql`${table.externalReference} is not null`),
  ],
);

export const tripStatuses = [
  "created",
  "in_transit",
  "completed",
  "cancelled",
] as const;

export type TripStatus = (typeof tripStatuses)[number];

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceNumber: text("reference_number").notNull().unique(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => logisticsVendors.id, { onDelete: "restrict" }),
    driverId: uuid("driver_id")
      .references(() => drivers.id, { onDelete: "restrict" }),
    status: text("status").$type<TripStatus>().default("created").notNull(),
    pickupAddress: text("pickup_address").notNull(),
    pickupLatitude: doublePrecision("pickup_latitude").notNull(),
    pickupLongitude: doublePrecision("pickup_longitude").notNull(),
    dropoffAddress: text("dropoff_address").notNull(),
    dropoffLatitude: doublePrecision("dropoff_latitude").notNull(),
    dropoffLongitude: doublePrecision("dropoff_longitude").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      "trips_status_check",
      sql`${table.status} in ('created', 'in_transit', 'completed', 'cancelled')`,
    ),
    check(
      "trips_pickup_latitude_check",
      sql`${table.pickupLatitude} between -90 and 90`,
    ),
    check(
      "trips_pickup_longitude_check",
      sql`${table.pickupLongitude} between -180 and 180`,
    ),
    check(
      "trips_dropoff_latitude_check",
      sql`${table.dropoffLatitude} between -90 and 90`,
    ),
    check(
      "trips_dropoff_longitude_check",
      sql`${table.dropoffLongitude} between -180 and 180`,
    ),
    index("trips_status_updated_at_idx").on(table.status, table.updatedAt),
    uniqueIndex("trips_vehicle_active_unique")
      .on(table.vehicleId)
      .where(sql`${table.status} in ('created', 'in_transit')`),
    uniqueIndex("trips_driver_active_unique")
      .on(table.driverId)
      .where(sql`${table.status} in ('created', 'in_transit')`),
  ],
);

export const positionSources = ["vendor", "simulator"] as const;
export type PositionSource = (typeof positionSources)[number];

export const tripPositions = pgTable(
  "trip_positions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    speed: doublePrecision("speed"),
    source: text("source").$type<PositionSource>().notNull(),
    sourceEventId: text("source_event_id"),
  },
  (table) => [
    check(
      "trip_positions_latitude_check",
      sql`${table.latitude} between -90 and 90`,
    ),
    check(
      "trip_positions_longitude_check",
      sql`${table.longitude} between -180 and 180`,
    ),
    check(
      "trip_positions_speed_check",
      sql`${table.speed} is null or ${table.speed} >= 0`,
    ),
    check(
      "trip_positions_source_check",
      sql`${table.source} in ('vendor', 'simulator')`,
    ),
    index("trip_positions_trip_recorded_at_idx").on(
      table.tripId,
      table.recordedAt,
      table.id,
    ),
    uniqueIndex("trip_positions_source_event_unique")
      .on(table.tripId, table.sourceEventId)
      .where(sql`${table.sourceEventId} is not null`),
  ],
);

export const customersRelations = relations(customers, ({ many }) => ({
  vehicles: many(vehicles),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  customer: one(customers, {
    fields: [vehicles.customerId],
    references: [customers.id],
  }),
  trips: many(trips),
}));

export const vendorsRelations = relations(logisticsVendors, ({ many }) => ({
  drivers: many(drivers),
  trips: many(trips),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  vendor: one(logisticsVendors, {
    fields: [drivers.vendorId],
    references: [logisticsVendors.id],
  }),
  trips: many(trips),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id],
  }),
  driver: one(drivers, {
    fields: [trips.driverId],
    references: [drivers.id],
  }),
  vendor: one(logisticsVendors, {
    fields: [trips.vendorId],
    references: [logisticsVendors.id],
  }),
  positions: many(tripPositions),
}));

export const tripPositionsRelations = relations(tripPositions, ({ one }) => ({
  trip: one(trips, {
    fields: [tripPositions.tripId],
    references: [trips.id],
  }),
}));

export type Customer = typeof customers.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type LogisticsVendor = typeof logisticsVendors.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type Trip = typeof trips.$inferSelect;
export type TripPosition = typeof tripPositions.$inferSelect;
