import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/db/client";
import { PositionRepository } from "@/repositories/position-repository";
import { TripRepository } from "@/repositories/trip-repository";
import { LocationService } from "@/services/location-service";
import {
  PostgresPositionEventSource,
  PostgresPositionPublisher,
} from "@/services/position-events";
import { SimulatorService } from "@/services/simulator-service";
import { TripService } from "@/services/trip-service";

function buildContainer() {
  const { db, pool } = getDatabase();
  const tripRepository = new TripRepository(db);
  const positionRepository = new PositionRepository(db);
  const tripService = new TripService(tripRepository, positionRepository);
  const positionPublisher = new PostgresPositionPublisher(pool);
  const locationService = new LocationService(
    tripService,
    positionRepository,
    positionPublisher,
  );
  const positionEvents = new PostgresPositionEventSource(
    getEnvironment().DATABASE_URL,
  );
  const simulatorService = new SimulatorService(tripService, locationService);

  return {
    tripService,
    locationService,
    positionRepository,
    positionEvents,
    simulatorService,
  };
}

export type AppContainer = ReturnType<typeof buildContainer>;

const globalForContainer = globalThis as unknown as {
  appContainer?: AppContainer;
};

export function getContainer(): AppContainer {
  if (!globalForContainer.appContainer) {
    globalForContainer.appContainer = buildContainer();
  }
  return globalForContainer.appContainer;
}
