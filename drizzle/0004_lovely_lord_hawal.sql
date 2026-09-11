DROP INDEX "trips_driver_active_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "trips_driver_active_unique" ON "trips" USING btree ("driver_id") WHERE "trips"."status" = 'in_transit';