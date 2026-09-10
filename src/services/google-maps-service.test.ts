import { describe, expect, it, vi } from "vitest";
import {
  GoogleMapsLocationNotFoundError,
  GoogleMapsResolutionError,
  InvalidGoogleMapsLinkError,
} from "@/domain/errors";
import { GoogleMapsService } from "./google-maps-service";

const longUrl =
  "https://www.google.com/maps/place/Nola+Eatery+%26+Social+House/@25.0698358,55.1486213,15z/data=!4m6!3m5!1s0x3e5f6ca93b2f1975:0xb514b2a0e2662bf!8m2!3d25.074526!4d55.1455321!16s%2Fg%2F11bwfmjjr1?entry=ttu";

describe("GoogleMapsService", () => {
  it("extracts the place and exact coordinates from a full Maps URL", async () => {
    const service = new GoogleMapsService();

    await expect(service.resolve(longUrl)).resolves.toEqual({
      name: "Nola Eatery & Social House",
      lat: 25.074526,
      lng: 55.1455321,
    });
  });

  it("resolves a short Maps URL before parsing it", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: longUrl },
      }),
    );
    const service = new GoogleMapsService(fetchImpl);

    await expect(
      service.resolve("https://maps.app.goo.gl/t7tCvNe3TnJW9cQa7"),
    ).resolves.toMatchObject({
      name: "Nola Eatery & Social House",
      lat: 25.074526,
      lng: 55.1455321,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://maps.app.goo.gl/t7tCvNe3TnJW9cQa7"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("prefers exact place coordinates over viewport coordinates", async () => {
    const service = new GoogleMapsService();

    await expect(
      service.resolve(
        "https://www.google.com/maps/place/Test+Place/@1,2,15z/data=!3d3!4d4",
      ),
    ).resolves.toEqual({ name: "Test Place", lat: 3, lng: 4 });
  });

  it("supports viewport and query coordinate forms", async () => {
    const service = new GoogleMapsService();

    await expect(
      service.resolve(
        "https://maps.google.com/maps/place/Query+Place/@25.2,55.3,17z",
      ),
    ).resolves.toEqual({ name: "Query Place", lat: 25.2, lng: 55.3 });
    await expect(
      service.resolve(
        "https://www.google.com/maps/search/Destination?query=25.4%2C55.5",
      ),
    ).resolves.toEqual({ name: "Destination", lat: 25.4, lng: 55.5 });
  });

  it("rejects malformed, non-HTTPS, and non-Google URLs", async () => {
    const service = new GoogleMapsService();

    await expect(service.resolve("not a URL")).rejects.toBeInstanceOf(
      InvalidGoogleMapsLinkError,
    );
    await expect(
      service.resolve("http://www.google.com/maps/place/Test/@1,2,3z"),
    ).rejects.toBeInstanceOf(InvalidGoogleMapsLinkError);
    await expect(
      service.resolve("https://example.com/maps/place/Test/@1,2,3z"),
    ).rejects.toBeInstanceOf(InvalidGoogleMapsLinkError);
  });

  it("does not follow redirects outside the Maps host allowlist", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://example.com/private" },
      }),
    );
    const service = new GoogleMapsService(fetchImpl);

    await expect(
      service.resolve("https://maps.app.goo.gl/example"),
    ).rejects.toBeInstanceOf(InvalidGoogleMapsLinkError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects Maps URLs without both a name and coordinates", async () => {
    const service = new GoogleMapsService();

    await expect(
      service.resolve("https://www.google.com/maps"),
    ).rejects.toBeInstanceOf(GoogleMapsLocationNotFoundError);
  });

  it("maps redirect failures and timeouts to a resolution error", async () => {
    const failedFetch = vi.fn().mockRejectedValue(new Error("network failed"));
    const hangingFetch = vi.fn(
      (_input: string | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    await expect(
      new GoogleMapsService(failedFetch).resolve(
        "https://maps.app.goo.gl/network",
      ),
    ).rejects.toBeInstanceOf(GoogleMapsResolutionError);
    await expect(
      new GoogleMapsService(hangingFetch, 1).resolve(
        "https://maps.app.goo.gl/timeout",
      ),
    ).rejects.toBeInstanceOf(GoogleMapsResolutionError);
  });
});
