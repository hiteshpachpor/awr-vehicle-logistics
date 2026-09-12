import { RouteGuard } from "@/components/auth/route-guard";
import { TripListWorkspace } from "@/components/operations/trip-list-workspace";

export default async function VendorTripsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return (
    <RouteGuard role="controller" vendorId={vendorId}>
      <TripListWorkspace vendorId={vendorId} />
    </RouteGuard>
  );
}
