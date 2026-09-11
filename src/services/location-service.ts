import type { IngestLocationInput } from "@/domain/contracts";
import type { PositionSource } from "@/db/schema";
import { PositionRepository } from "@/repositories/position-repository";
import { TripService } from "./trip-service";
import type { PositionPublisher } from "./position-events";

export class LocationService {
  constructor(
    private readonly trips: TripService,
    private readonly positions: PositionRepository,
    private readonly publisher: PositionPublisher,
  ) {}

  async ingest(
    tripId: string,
    input: IngestLocationInput,
    source: PositionSource = "vendor",
  ) {
    await this.trips.requireInTransit(tripId);

    const result = await this.positions.create({
      tripId,
      latitude: input.lat,
      longitude: input.lng,
      recordedAt: new Date(input.timestamp),
      speed: input.speed,
      source,
      sourceEventId: input.eventId,
    });

    if (result.created) {
      await this.publisher.publish({
        tripId,
        positionId: result.position.id,
      });
    }

    return result;
  }
}
