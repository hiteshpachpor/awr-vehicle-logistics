import { randomUUID } from "node:crypto";
import type { SimulationRequest } from "@/domain/contracts";
import { ConflictError } from "@/domain/errors";
import { fetchDrivingRoute } from "@/lib/mapbox-route";
import {
  sampleRoute,
  type LatLng,
} from "@/lib/route-geometry";
import {
  SIMULATION_INTERVAL_MS,
  SIMULATION_STEP_METERS,
  simulationSpeedKmh,
} from "@/lib/simulation";
import type { LocationService } from "./location-service";
import type { TripService } from "./trip-service";

export {
  SIMULATION_INTERVAL_MS,
  SIMULATION_STEP_METERS,
  SIMULATION_SPEED_KMH,
  simulationSpeedKmh,
} from "@/lib/simulation";

export type FetchSimulationRoute = (
  from: LatLng,
  to: LatLng,
) => Promise<LatLng[] | null>;

type Simulation = {
  timer: ReturnType<typeof setInterval>;
  sessionId: string;
  nextPoint: number;
  route: LatLng[];
  intervalMs: number;
  stepMeters: number;
};

export type SimulationStatus =
  | { status: "idle" }
  | {
      status: "running";
      intervalMs: number;
      stepMeters: number;
      speedKmh: number;
    };

export async function fetchMapboxSimulationRoute(
  from: LatLng,
  to: LatLng,
): Promise<LatLng[] | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return null;
  }

  const coordinates = await fetchDrivingRoute(
    token,
    [from.lng, from.lat],
    [to.lng, to.lat],
  );
  if (!coordinates?.length) {
    return null;
  }

  return coordinates.map(([lng, lat]) => ({ lat, lng }));
}

export class SimulatorService {
  private readonly simulations = new Map<string, Simulation>();

  constructor(
    private readonly trips: TripService,
    private readonly locations: LocationService,
    private readonly now: () => Date = () => new Date(),
    private readonly makeId: () => string = randomUUID,
    private readonly fetchRoute: FetchSimulationRoute = fetchMapboxSimulationRoute,
  ) {}

  async start(tripId: string, options: SimulationRequest = {}) {
    if (this.simulations.has(tripId)) {
      throw new ConflictError(
        "A simulation is already running for this trip",
        "SIMULATION_ALREADY_RUNNING",
      );
    }

    const intervalMs = options.intervalMs ?? SIMULATION_INTERVAL_MS;
    const stepMeters = options.stepMeters ?? SIMULATION_STEP_METERS;

    const trip = await this.trips.get(tripId);
    if (trip.trip.status !== "created" && trip.trip.status !== "in_transit") {
      throw new ConflictError(
        "Only created or in-transit trips can be simulated",
        "TRIP_NOT_SIMULATABLE",
      );
    }

    const pickup = {
      lat: trip.trip.pickupLatitude,
      lng: trip.trip.pickupLongitude,
    };
    const dropoff = {
      lat: trip.trip.dropoffLatitude,
      lng: trip.trip.dropoffLongitude,
    };
    const path = await this.resolvePath(pickup, dropoff);
    const route = sampleRoute(path, stepMeters);

    if (trip.trip.status === "created") {
      await this.trips.transition(tripId, "in_transit");
    }

    const sessionId = this.makeId();
    const simulation: Simulation = {
      sessionId,
      nextPoint: 0,
      route,
      intervalMs,
      stepMeters,
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

    return {
      tripId,
      sessionId,
      intervalMs,
      stepMeters,
      speedKmh: simulationSpeedKmh(stepMeters, intervalMs),
      status: "running" as const,
    };
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

  getStatus(tripId: string): SimulationStatus {
    const simulation = this.simulations.get(tripId);
    if (!simulation) {
      return { status: "idle" };
    }
    return {
      status: "running",
      intervalMs: simulation.intervalMs,
      stepMeters: simulation.stepMeters,
      speedKmh: simulationSpeedKmh(
        simulation.stepMeters,
        simulation.intervalMs,
      ),
    };
  }

  private async resolvePath(pickup: LatLng, dropoff: LatLng) {
    try {
      const routed = await this.fetchRoute(pickup, dropoff);
      if (routed?.length) {
        return routed;
      }
    } catch {
      // Fall back to a geodesic line when Mapbox is unavailable.
    }

    return [pickup, dropoff];
  }

  private async tick(tripId: string) {
    const simulation = this.simulations.get(tripId);
    if (!simulation) {
      return;
    }
    const point = simulation.route[simulation.nextPoint];
    if (!point) {
      await this.trips.transition(tripId, "completed");
      this.stop(tripId);
      return;
    }

    await this.locations.ingest(
      tripId,
      {
        lat: point.lat,
        lng: point.lng,
        timestamp: this.now().toISOString(),
        speed: simulationSpeedKmh(
          simulation.stepMeters,
          simulation.intervalMs,
        ),
        eventId: `${simulation.sessionId}-${simulation.nextPoint}`,
      },
      "simulator",
    );
    simulation.nextPoint += 1;
  }
}
