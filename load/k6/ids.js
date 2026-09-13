export function loadTripId(index) {
  return `00000000-0000-4000-9500-${String(index).padStart(12, "0")}`;
}

export function loadTripCount() {
  const count = Number(__ENV.LOAD_TRIPS || 200);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("LOAD_TRIPS must be a positive integer");
  }
  return count;
}

export function baseUrl() {
  return __ENV.BASE_URL || "http://application:3000";
}
