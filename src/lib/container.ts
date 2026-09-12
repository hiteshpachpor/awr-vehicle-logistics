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
import {
  PostgresTripListEventSource,
  PostgresTripListPublisher,
} from "@/services/trip-list-events";
import { TripService } from "@/services/trip-service";

const globalForEvents = globalThis as unknown as {
  positionEvents?: PostgresPositionEventSource;
  tripListEvents?: PostgresTripListEventSource;
  tripService?: TripService;
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

function getTripListEvents() {
  if (!globalForEvents.tripListEvents) {
    globalForEvents.tripListEvents = new PostgresTripListEventSource(
      getEnvironment().DATABASE_URL,
    );
  }
  return globalForEvents.tripListEvents;
}

function getTripService(
  tripRepository: TripRepository,
  positionRepository: PositionRepository,
  listPublisher: PostgresTripListPublisher,
) {
  if (!globalForEvents.tripService) {
    globalForEvents.tripService = new TripService(
      tripRepository,
      positionRepository,
      listPublisher,
    );
  }
  return globalForEvents.tripService;
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
  const tripListPublisher = new PostgresTripListPublisher(pool);
  const tripService = getTripService(
    tripRepository,
    positionRepository,
    tripListPublisher,
  );
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
    tripListEvents: getTripListEvents(),
    simulatorService: getSimulatorService(tripService, locationService),
  };
}

export type AppContainer = ReturnType<typeof getContainer>;
