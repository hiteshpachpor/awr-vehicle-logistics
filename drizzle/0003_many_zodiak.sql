ALTER TABLE "trips" ALTER COLUMN "driver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
UPDATE "trips"
SET "vendor_id" = "drivers"."vendor_id"
FROM "drivers"
WHERE "trips"."driver_id" = "drivers"."id";--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "vendor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vendor_id_logistics_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."logistics_vendors"("id") ON DELETE restrict ON UPDATE no action;