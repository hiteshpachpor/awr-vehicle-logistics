import {
  makeBrowserEventId,
  makeDriverLocationPayload,
} from "@/lib/driver-location";

export const DRIVER_LOCATION_OUTBOX_CAP = 720;
export const DRIVER_LOCATION_OUTBOX_KEY_PREFIX =
  "awr:driver-location-outbox:";

export type DriverLocationOutboxItem = ReturnType<
  typeof makeDriverLocationPayload
>;

export type DriverLocationOutboxStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const sharedMemoryStorage = createMemoryStorage();

export function createMemoryStorage(): DriverLocationOutboxStorage {
  const data = new Map<string, string>();
  return {
    getItem(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

export function createDriverLocationOutbox(
  storage?: DriverLocationOutboxStorage,
) {
  const store = withMemoryFallback(storage ?? browserLocalStorage());
  const cache = new Map<string, DriverLocationOutboxItem[]>();

  function load(tripId: string): DriverLocationOutboxItem[] {
    const cached = cache.get(tripId);
    if (cached) return cached;
    const raw = store.getItem(storageKey(tripId));
    if (!raw) {
      cache.set(tripId, []);
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? sortItems(parsed.filter(isOutboxItem))
        : [];
      cache.set(tripId, items);
      return items;
    } catch {
      cache.set(tripId, []);
      return [];
    }
  }

  function persist(tripId: string, items: DriverLocationOutboxItem[]) {
    const next = sortItems(items);
    cache.set(tripId, next);
    store.setItem(storageKey(tripId), JSON.stringify(next));
  }

  function enqueue(
    tripId: string,
    position: Pick<GeolocationPosition, "coords" | "timestamp">,
  ) {
    const eventId = makeBrowserEventId(tripId, position.timestamp);
    const items = load(tripId);
    if (items.some((item) => item.eventId === eventId)) {
      return null;
    }

    const payload = makeDriverLocationPayload(position, eventId);
    items.push(payload);
    persist(tripId, capItems(sortItems(items)));
    return payload;
  }

  function peek(tripId: string) {
    return load(tripId)[0] ?? null;
  }

  function ack(tripId: string, eventId: string) {
    persist(
      tripId,
      load(tripId).filter((item) => item.eventId !== eventId),
    );
  }

  function size(tripId: string) {
    return load(tripId).length;
  }

  return { enqueue, peek, ack, load, size };
}

function storageKey(tripId: string) {
  return `${DRIVER_LOCATION_OUTBOX_KEY_PREFIX}${tripId}`;
}

function capItems(items: DriverLocationOutboxItem[]) {
  if (items.length <= DRIVER_LOCATION_OUTBOX_CAP) return items;
  return items.slice(items.length - DRIVER_LOCATION_OUTBOX_CAP);
}

function sortItems(items: DriverLocationOutboxItem[]) {
  return [...items].sort((left, right) => {
    const timeDelta =
      Date.parse(left.timestamp) - Date.parse(right.timestamp);
    return timeDelta || left.eventId.localeCompare(right.eventId);
  });
}

function isOutboxItem(value: unknown): value is DriverLocationOutboxItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DriverLocationOutboxItem>;
  return (
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    typeof item.timestamp === "string" &&
    typeof item.eventId === "string" &&
    (item.speed === undefined || typeof item.speed === "number")
  );
}

function withMemoryFallback(
  primary: DriverLocationOutboxStorage | undefined,
): DriverLocationOutboxStorage {
  return {
    getItem(key) {
      if (primary) {
        try {
          return primary.getItem(key);
        } catch {
          // Use the in-memory copy when storage is unavailable.
        }
      }
      return sharedMemoryStorage.getItem(key);
    },
    setItem(key, value) {
      if (primary) {
        try {
          primary.setItem(key, value);
          return;
        } catch {
          // Fall through to in-memory storage.
        }
      }
      sharedMemoryStorage.setItem(key, value);
    },
  };
}

function browserLocalStorage(): DriverLocationOutboxStorage | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    return localStorage;
  } catch {
    return undefined;
  }
}
