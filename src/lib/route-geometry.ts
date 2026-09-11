export type LatLng = {
  lat: number;
  lng: number;
};

export const LOCATION_MATCH_METERS = 50;
const EARTH_RADIUS_M = 6_371_000;
const SAME_POINT_METERS = 1;

export function isSameLocation(
  from: LatLng,
  to: LatLng,
  thresholdMeters = LOCATION_MATCH_METERS,
) {
  return haversineMeters(from, to) < thresholdMeters;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(from: LatLng, to: LatLng) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function interpolate(from: LatLng, to: LatLng, fraction: number): LatLng {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

export function sampleRoute(
  coordinates: readonly LatLng[],
  stepMeters = 1_000,
): LatLng[] {
  const start = coordinates[0];
  if (!start) {
    return [];
  }

  const samples: LatLng[] = [{ ...start }];
  if (coordinates.length === 1 || stepMeters <= 0) {
    return samples;
  }

  let leftover = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index];
    const to = coordinates[index + 1];
    if (!from || !to) {
      continue;
    }
    const length = haversineMeters(from, to);
    if (length === 0) {
      continue;
    }

    let consumed = 0;
    while (leftover + (length - consumed) >= stepMeters) {
      const need = stepMeters - leftover;
      consumed += need;
      samples.push(interpolate(from, to, consumed / length));
      leftover = 0;
    }
    leftover += length - consumed;
  }

  const end = coordinates[coordinates.length - 1];
  const lastSample = samples[samples.length - 1];
  if (
    end &&
    lastSample &&
    haversineMeters(lastSample, end) >= SAME_POINT_METERS
  ) {
    samples.push({ ...end });
  }

  return samples;
}
