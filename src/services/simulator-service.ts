import { randomUUID } from "node:crypto";
import { ConflictError } from "@/domain/errors";
import type { LocationService } from "./location-service";
import type { TripService } from "./trip-service";

export const demoRoute = [
  { lat: 25.2048, lng: 55.2708 },
  { lat: 25.218, lng: 55.286 },
  { lat: 25.232, lng: 55.301 },
  { lat: 25.249, lng: 55.319 },
  { lat: 25.269, lng: 55.34 },
  { lat: 25.289, lng: 55.361 },
  { lat: 25.308, lng: 55.383 },
  { lat: 25.326, lng: 55.402 },
  { lat: 25.3463, lng: 55.4209 },
] as const;

type Simulation = {
  timer: ReturnType<typeof setInterval>;
  sessionId: string;
  nextPoint: number;
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
    const point = demoRoute[simulation.nextPoint];
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
