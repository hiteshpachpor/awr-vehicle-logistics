import { RouteGuard } from "@/components/auth/route-guard";
import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RouteGuard role="authenticated">
      <OperationsDashboard initialTripId={id} focused />
    </RouteGuard>
  );
}
