import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  tripPositions,
  type PositionSource,
  type TripPosition,
} from "@/db/schema";

export type NewPosition = {
  tripId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  speed?: number;
  source: PositionSource;
  sourceEventId?: string;
};

export class PositionRepository {
  constructor(private readonly db: Database) {}

  async create(
    input: NewPosition,
  ): Promise<{ position: TripPosition; created: boolean }> {
    const [position] = await this.db
      .insert(tripPositions)
      .values(input)
      .onConflictDoNothing()
      .returning();

    if (position) {
      return { position, created: true };
    }

    if (!input.sourceEventId) {
      throw new Error("Position insert failed without an idempotency key");
    }

    const [existing] = await this.db
      .select()
      .from(tripPositions)
      .where(
        and(
          eq(tripPositions.tripId, input.tripId),
          eq(tripPositions.sourceEventId, input.sourceEventId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error("Duplicate position could not be retrieved");
    }

    return { position: existing, created: false };
  }

  async findById(id: number): Promise<TripPosition | null> {
    const [position] = await this.db
      .select()
      .from(tripPositions)
      .where(eq(tripPositions.id, id))
      .limit(1);
    return position ?? null;
  }

  async latestForTrips(
    tripIds: string[],
  ): Promise<Map<string, TripPosition>> {
    if (tripIds.length === 0) {
      return new Map();
    }

    const positions = await this.db
      .selectDistinctOn([tripPositions.tripId])
      .from(tripPositions)
      .where(inArray(tripPositions.tripId, tripIds))
      .orderBy(
        tripPositions.tripId,
        desc(tripPositions.recordedAt),
        desc(tripPositions.id),
      );

    return new Map(positions.map((position) => [position.tripId, position]));
  }

  async listRecent(
    tripId: string,
    limit = 100,
  ): Promise<TripPosition[]> {
    return this.db
      .select()
      .from(tripPositions)
      .where(eq(tripPositions.tripId, tripId))
      .orderBy(
        desc(tripPositions.recordedAt),
        desc(tripPositions.id),
      )
      .limit(limit);
  }

  async listAfter(
    tripId: string,
    afterId: number,
    limit = 1_000,
  ): Promise<TripPosition[]> {
    return this.db
      .select()
      .from(tripPositions)
      .where(
        and(
          eq(tripPositions.tripId, tripId),
          gt(tripPositions.id, afterId),
        ),
      )
      .orderBy(asc(tripPositions.id))
      .limit(limit);
  }
}
