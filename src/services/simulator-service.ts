import { randomUUID } from "node:crypto";
import { ConflictError } from "@/domain/errors";
import type { LocationService } from "./location-service";
import type { TripService, TripView } from "./trip-service";

const SIMULATION_POINT_COUNT = 12;

export function buildSimulationRoute(
  trip: TripView,
  pointCount = SIMULATION_POINT_COUNT,
) {
  const totalPoints = Math.max(2, pointCount);
  const start = trip.latestPosition
    ? {
        lat: trip.latestPosition.latitude,
        lng: trip.latestPosition.longitude,
      }
    : {
        lat: trip.trip.pickupLatitude,
        lng: trip.trip.pickupLongitude,
      };
  const destination = {
    lat: trip.trip.dropoffLatitude,
    lng: trip.trip.dropoffLongitude,
  };

  return Array.from({ length: totalPoints }, (_, index) => {
    const progress = index / (totalPoints - 1);
    return {
      lat: start.lat + (destination.lat - start.lat) * progress,
      lng: start.lng + (destination.lng - start.lng) * progress,
    };
  });
}

type Simulation = {
  timer: ReturnType<typeof setInterval>;
  sessionId: string;
  nextPoint: number;
  route: Array<{ lat: number; lng: number }>;
};

export class SimulatorService {
  private readonly simulations = new Map<string, Simulation>();

  constructor(
    private readonly trips: TripService,
    private readonly locations: LocationService,
    private readonly now: () => Date = () => new Date(),
    private readonly makeId: () => string = randomUUID,
  ) {}

  async start(tripId: string, intervalMs: number) {
    if (this.simulations.has(tripId)) {
      throw new ConflictError(
        "A simulation is already running for this trip",
        "SIMULATION_ALREADY_RUNNING",
      );
    }

    const trip = await this.trips.get(tripId);
    if (trip.trip.status === "created") {
      await this.trips.transition(tripId, "in_transit");
    } else if (trip.trip.status !== "in_transit") {
      throw new ConflictError(
        "Only created or in-transit trips can be simulated",
        "TRIP_NOT_SIMULATABLE",
      );
    }

    const sessionId = this.makeId();
    const simulation: Simulation = {
      sessionId,
      nextPoint: 0,
      route: buildSimulationRoute(trip),
      timer: setInterval(() => {
        void this.tick(tripId).catch(() => this.stop(tripId));
      }, intervalMs),
    };
    this.simulations.set(tripId, simulation);
    try {
      await this.tick(tripId);
    } catch (error) {
      this.stop(tripId);
      throw error;
    }

    return { tripId, sessionId, intervalMs, status: "running" as const };
  }

  stop(tripId: string) {
    const simulation = this.simulations.get(tripId);
    if (!simulation) {
      return false;
    }
    clearInterval(simulation.timer);
    this.simulations.delete(tripId);
    return true;
  }

  isRunning(tripId: string) {
    return this.simulations.has(tripId);
  }

  private async tick(tripId: string) {
    const simulation = this.simulations.get(tripId);
    if (!simulation) {
      return;
    }
    const point = simulation.route[simulation.nextPoint];
    if (!point) {
      this.stop(tripId);
      await this.trips.transition(tripId, "completed");
      return;
    }

    await this.locations.ingest(
      tripId,
      {
        lat: point.lat,
        lng: point.lng,
        timestamp: this.now().toISOString(),
        speed: 12,
        eventId: `${simulation.sessionId}-${simulation.nextPoint}`,
      },
      "simulator",
    );
    simulation.nextPoint += 1;
  }
}
