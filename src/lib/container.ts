import { getEnvironment } from "@/config/env";
import { getDatabase } from "@/db/client";
import { OperationsRepository } from "@/repositories/operations-repository";
import { PositionRepository } from "@/repositories/position-repository";
import { TripRepository } from "@/repositories/trip-repository";
import { LocationService } from "@/services/location-service";
import { OperationsService } from "@/services/operations-service";
import {
  PostgresPositionEventSource,
  PostgresPositionPublisher,
} from "@/services/position-events";
import { SimulatorService } from "@/services/simulator-service";
import { TripService } from "@/services/trip-service";

const globalForEvents = globalThis as unknown as {
  positionEvents?: PostgresPositionEventSource;
  simulatorService?: SimulatorService;
};

function getPositionEvents() {
  if (!globalForEvents.positionEvents) {
    globalForEvents.positionEvents = new PostgresPositionEventSource(
      getEnvironment().DATABASE_URL,
    );
  }
  return globalForEvents.positionEvents;
}

function getSimulatorService(
  tripService: TripService,
  locationService: LocationService,
) {
  if (!globalForEvents.simulatorService) {
    globalForEvents.simulatorService = new SimulatorService(
      tripService,
      locationService,
    );
  }
  return globalForEvents.simulatorService;
}

export function getContainer() {
  const { db, pool } = getDatabase();
  const tripRepository = new TripRepository(db);
  const positionRepository = new PositionRepository(db);
  const operationsRepository = new OperationsRepository(db);
  const tripService = new TripService(tripRepository, positionRepository);
  const operationsService = new OperationsService(operationsRepository);
  const positionPublisher = new PostgresPositionPublisher(pool);
  const locationService = new LocationService(
    tripService,
    positionRepository,
    positionPublisher,
  );

  return {
    tripService,
    operationsService,
    locationService,
    positionRepository,
    positionEvents: getPositionEvents(),
    simulatorService: getSimulatorService(tripService, locationService),
  };
}

export type AppContainer = ReturnType<typeof getContainer>;
