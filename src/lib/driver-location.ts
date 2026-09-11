const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 15_000,
};

export type DriverLocationFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

export type StartTripLocationError = {
  title: string;
  description: string;
  hint: string;
};

type GeolocationReader = {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback,
    options?: PositionOptions,
  ) => void;
};

export class DriverLocationAccessError extends Error {
  readonly reason: DriverLocationFailure;

  constructor(reason: DriverLocationFailure) {
    super(reason);
    this.name = "DriverLocationAccessError";
    this.reason = reason;
  }
}

export function makeDriverLocationPayload(
  position: Pick<GeolocationPosition, "coords" | "timestamp">,
  eventId: string,
) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: new Date(position.timestamp).toISOString(),
    ...(position.coords.speed === null
      ? {}
      : { speed: position.coords.speed * 3.6 }),
    eventId,
  };
}

export function startTripLocationError(
  reason: DriverLocationFailure,
): StartTripLocationError {
  if (reason === "denied") {
    return {
      title: "Location is required",
      description: "Location must be enabled to start this trip.",
      hint: "Allow location access in your browser, then try Start trip again.",
    };
  }
  if (reason === "unsupported") {
    return {
      title: "Location is required",
      description: "This browser cannot share location.",
      hint: "Open the driver workspace in a browser that supports location, then try again.",
    };
  }
  return {
    title: "Location is required",
    description: "Your current location could not be read.",
    hint: "Turn on location services, then try Start trip again.",
  };
}

export function requestDriverLocationAccess(
  geolocation: GeolocationReader | null | undefined = globalGeolocation(),
) {
  if (!geolocation) {
    return Promise.reject(new DriverLocationAccessError("unsupported"));
  }

  return new Promise<void>((resolve, reject) => {
    geolocation.getCurrentPosition(
      () => resolve(),
      (error) => reject(toDriverLocationAccessError(error)),
      LOCATION_OPTIONS,
    );
  });
}

function globalGeolocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return undefined;
  }
  return navigator.geolocation;
}

function toDriverLocationAccessError(
  error: Pick<GeolocationPositionError, "code">,
) {
  if (error.code === 1) {
    return new DriverLocationAccessError("denied");
  }
  if (error.code === 3) {
    return new DriverLocationAccessError("timeout");
  }
  return new DriverLocationAccessError("unavailable");
}
