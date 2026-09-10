import { OperationsDashboard } from "@/components/operations/operations-dashboard";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OperationsDashboard initialTripId={id} focused />;
}
