import { describe, expect, it, vi } from "vitest";
import {
  DriverLocationAccessError,
  makeDriverLocationPayload,
  requestDriverLocationAccess,
  startTripLocationError,
} from "./driver-location";

describe("driver location payload", () => {
  it("converts browser speed to kilometres per hour", () => {
    const payload = makeDriverLocationPayload(
      {
        coords: {
          latitude: 25.2,
          longitude: 55.3,
          speed: 10,
        } as GeolocationCoordinates,
        timestamp: Date.parse("2026-09-10T10:00:00Z"),
      },
      "browser-event-1",
    );

    expect(payload).toEqual({
      lat: 25.2,
      lng: 55.3,
      timestamp: "2026-09-10T10:00:00.000Z",
      speed: 36,
      eventId: "browser-event-1",
    });
  });
});

describe("requestDriverLocationAccess", () => {
  it("resolves when the browser returns a position", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({} as GeolocationPosition);
    });

    await expect(
      requestDriverLocationAccess({ getCurrentPosition }),
    ).resolves.toBeUndefined();
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );
  });

  it("rejects as unsupported when geolocation is missing", async () => {
    await expect(requestDriverLocationAccess(null)).rejects.toMatchObject({
      reason: "unsupported",
    });
    await expect(
      requestDriverLocationAccess(null),
    ).rejects.toBeInstanceOf(DriverLocationAccessError);
  });

  it.each([
    [1, "denied"],
    [2, "unavailable"],
    [3, "timeout"],
  ] as const)("maps geolocation error %s to %s", async (code, reason) => {
    const getCurrentPosition = vi.fn(
      (
        _success: PositionCallback,
        error?: PositionErrorCallback,
      ) => {
        error?.({ code } as GeolocationPositionError);
      },
    );

    await expect(
      requestDriverLocationAccess({ getCurrentPosition }),
    ).rejects.toMatchObject({ reason });
  });
});

describe("startTripLocationError", () => {
  it("tells the driver location must be enabled when access is denied", () => {
    expect(startTripLocationError("denied")).toEqual({
      title: "Location is required",
      description: "Location must be enabled to start this trip.",
      hint: "Allow location access in your browser, then try Start trip again.",
    });
  });

  it("explains unsupported browsers and unread locations", () => {
    expect(startTripLocationError("unsupported").description).toBe(
      "This browser cannot share location.",
    );
    expect(startTripLocationError("unavailable").description).toBe(
      "Your current location could not be read.",
    );
    expect(startTripLocationError("timeout").description).toBe(
      "Your current location could not be read.",
    );
  });
});
