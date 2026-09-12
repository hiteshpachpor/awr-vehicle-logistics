import { RouteGuard } from "@/components/auth/route-guard";
import { TripListWorkspace } from "@/components/operations/trip-list-workspace";

export default async function DriverTripsPage({
  params,
}: {
  params: Promise<{ vendorId: string; driverId: string }>;
}) {
  const { vendorId, driverId } = await params;
  return (
    <RouteGuard role="driver" vendorId={vendorId} driverId={driverId}>
      <TripListWorkspace vendorId={vendorId} driverId={driverId} />
    </RouteGuard>
  );
}
