import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDrivingRoute } from "./mapbox-route";

describe("fetchDrivingRoute", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a full Mapbox driving geometry", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              geometry: {
                coordinates: [
                  [55.27, 25.2],
                  [55.42, 25.35],
                ],
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await expect(
      fetchDrivingRoute("pk.test", [55.27, 25.2], [55.42, 25.35]),
    ).resolves.toEqual([
      [55.27, 25.2],
      [55.42, 25.35],
    ]);

    const requested = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requested.pathname).toBe(
      "/directions/v5/mapbox/driving/55.27,25.2;55.42,25.35",
    );
    expect(requested.searchParams.get("geometries")).toBe("geojson");
    expect(requested.searchParams.get("overview")).toBe("full");
    expect(requested.searchParams.get("access_token")).toBe("pk.test");
  });

  it("returns null when Mapbox has no route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );

    await expect(
      fetchDrivingRoute("pk.test", [55.27, 25.2], [55.42, 25.35]),
    ).resolves.toBeNull();
  });
});
