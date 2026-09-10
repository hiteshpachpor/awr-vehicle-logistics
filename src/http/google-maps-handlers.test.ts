import { describe, expect, it, vi } from "vitest";
import { GoogleMapsLocationNotFoundError } from "@/domain/errors";
import { resolveGoogleMapsLinkHandler } from "./google-maps-handlers";

function request(body: unknown) {
  return new Request("http://localhost/api/google-maps/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Google Maps HTTP handler", () => {
  it("returns the resolved location in the API data envelope", async () => {
    const resolver = {
      resolve: vi.fn().mockResolvedValue({
        name: "Nola Eatery & Social House",
        lat: 25.074526,
        lng: 55.1455321,
      }),
    };

    const response = await resolveGoogleMapsLinkHandler(
      request({ url: "https://maps.app.goo.gl/example" }),
      resolver,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        name: "Nola Eatery & Social House",
        lat: 25.074526,
        lng: 55.1455321,
      },
    });
    expect(resolver.resolve).toHaveBeenCalledWith(
      "https://maps.app.goo.gl/example",
    );
  });

  it("rejects malformed request payloads before resolving", async () => {
    const resolver = { resolve: vi.fn() };

    const response = await resolveGoogleMapsLinkHandler(request({}), resolver);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it("returns client-safe resolver errors", async () => {
    const resolver = {
      resolve: vi
        .fn()
        .mockRejectedValue(new GoogleMapsLocationNotFoundError()),
    };

    const response = await resolveGoogleMapsLinkHandler(
      request({ url: "https://www.google.com/maps" }),
      resolver,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "GOOGLE_MAPS_LOCATION_NOT_FOUND",
        message:
          "The Google Maps link does not contain an extractable place name and coordinates",
      },
    });
  });
});
