import { RouteGuard } from "@/components/auth/route-guard";
import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function VendorTripsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return (
    <RouteGuard role="controller" vendorId={vendorId}>
      <OperationsDashboard vendorId={vendorId} />
    </RouteGuard>
  );
}
