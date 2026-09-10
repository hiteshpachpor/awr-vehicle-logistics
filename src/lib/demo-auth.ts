export type OperationsSession = {
  role: "operations";
};

export type ControllerSession = {
  role: "controller";
  vendorId: string;
  vendorName: string;
};

export type DriverSession = {
  role: "driver";
  vendorId: string;
  vendorName: string;
  driverId: string;
  driverName: string;
};

export type DemoSession =
  | OperationsSession
  | ControllerSession
  | DriverSession;

export const demoSessionStorageKey = "awr-demo-session";

export function getSessionHome(session: DemoSession) {
  if (session.role === "operations") return "/ops/trips";
  if (session.role === "controller") {
    return `/vendor/${session.vendorId}/trips`;
  }
  return `/vendor/${session.vendorId}/driver/${session.driverId}/trips`;
}

export function canAccessTrip(
  session: DemoSession,
  trip: {
    vendor: { id: string };
    driver: { id: string } | null;
  },
) {
  if (session.role === "operations") return true;
  if (trip.vendor.id !== session.vendorId) return false;
  if (session.role === "controller") return true;
  return trip.driver?.id === session.driverId;
}

export function parseDemoSession(value: string | null): DemoSession | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value) as Partial<DemoSession>;
    if (session.role === "operations") return { role: "operations" };
    if (
      session.role === "controller" &&
      typeof session.vendorId === "string" &&
      typeof session.vendorName === "string"
    ) {
      return {
        role: "controller",
        vendorId: session.vendorId,
        vendorName: session.vendorName,
      };
    }
    if (
      session.role === "driver" &&
      typeof session.vendorId === "string" &&
      typeof session.vendorName === "string" &&
      typeof session.driverId === "string" &&
      typeof session.driverName === "string"
    ) {
      return {
        role: "driver",
        vendorId: session.vendorId,
        vendorName: session.vendorName,
        driverId: session.driverId,
        driverName: session.driverName,
      };
    }
  } catch {
    return null;
  }
  return null;
}
