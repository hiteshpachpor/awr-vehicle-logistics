import { RouteGuard } from "@/components/auth/route-guard";
import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function DriverTripsPage({
  params,
}: {
  params: Promise<{ vendorId: string; driverId: string }>;
}) {
  const { vendorId, driverId } = await params;
  return (
    <RouteGuard role="driver" vendorId={vendorId} driverId={driverId}>
      <OperationsDashboard vendorId={vendorId} driverId={driverId} />
    </RouteGuard>
  );
}
