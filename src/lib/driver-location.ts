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
