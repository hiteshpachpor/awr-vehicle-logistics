import { describe, expect, it } from "vitest";
import { makeDriverLocationPayload } from "./driver-location";

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
