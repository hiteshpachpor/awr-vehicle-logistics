export type LngLat = [number, number];

export async function fetchDrivingRoute(
  token: string,
  from: LngLat,
  to: LngLat,
  signal?: AbortSignal,
): Promise<LngLat[] | null> {
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${from.join(",")};${to.join(",")}`,
  );
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const body = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: LngLat[] } }>;
  };
  const coordinates = body.routes?.[0]?.geometry?.coordinates;
  return coordinates?.length ? coordinates : null;
}
