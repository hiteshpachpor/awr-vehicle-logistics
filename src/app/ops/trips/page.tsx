import { RouteGuard } from "@/components/auth/route-guard";
import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function OperationsTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  return (
    <RouteGuard role="operations">
      <OperationsDashboard createdReference={created} />
    </RouteGuard>
  );
}
