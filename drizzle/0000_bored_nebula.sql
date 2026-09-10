CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"external_reference" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logistics_vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_positions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trip_positions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"trip_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"speed" double precision,
	"source" text NOT NULL,
	"source_event_id" text,
	CONSTRAINT "trip_positions_latitude_check" CHECK ("trip_positions"."latitude" between -90 and 90),
	CONSTRAINT "trip_positions_longitude_check" CHECK ("trip_positions"."longitude" between -180 and 180),
	CONSTRAINT "trip_positions_speed_check" CHECK ("trip_positions"."speed" is null or "trip_positions"."speed" >= 0),
	CONSTRAINT "trip_positions_source_check" CHECK ("trip_positions"."source" in ('vendor', 'simulator'))
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_number" text NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_latitude" double precision NOT NULL,
	"pickup_longitude" double precision NOT NULL,
	"dropoff_address" text NOT NULL,
	"dropoff_latitude" double precision NOT NULL,
	"dropoff_longitude" double precision NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_reference_number_unique" UNIQUE("reference_number"),
	CONSTRAINT "trips_status_check" CHECK ("trips"."status" in ('created', 'in_transit', 'completed', 'cancelled')),
	CONSTRAINT "trips_pickup_latitude_check" CHECK ("trips"."pickup_latitude" between -90 and 90),
	CONSTRAINT "trips_pickup_longitude_check" CHECK ("trips"."pickup_longitude" between -180 and 180),
	CONSTRAINT "trips_dropoff_latitude_check" CHECK ("trips"."dropoff_latitude" between -90 and 90),
	CONSTRAINT "trips_dropoff_longitude_check" CHECK ("trips"."dropoff_longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"registration_number" text NOT NULL,
	"vin" text,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_vendor_id_logistics_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."logistics_vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_positions" ADD CONSTRAINT "trip_positions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_vendor_external_reference_unique" ON "drivers" USING btree ("vendor_id","external_reference") WHERE "drivers"."external_reference" is not null;--> statement-breakpoint
CREATE INDEX "trip_positions_trip_recorded_at_idx" ON "trip_positions" USING btree ("trip_id","recorded_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "trip_positions_source_event_unique" ON "trip_positions" USING btree ("trip_id","source_event_id") WHERE "trip_positions"."source_event_id" is not null;--> statement-breakpoint
CREATE INDEX "trips_status_updated_at_idx" ON "trips" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_customer_registration_unique" ON "vehicles" USING btree ("customer_id","registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_vin_unique" ON "vehicles" USING btree ("vin") WHERE "vehicles"."vin" is not null;